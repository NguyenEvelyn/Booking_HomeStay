using System.Security.Claims;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record CompensationCatalogRequest(string Name, string Category, string? Description, string Unit, decimal ReplacementCost, decimal MaximumCompensation, decimal DefaultDepreciationPercent, bool IsActive = true);
public sealed record CompensationItemRequest(long? CatalogItemId, string? ItemName, string? Category, string DamageLevel, int Quantity, decimal? UnitAmount, decimal? DepreciationPercent, string? Note);
public sealed record CompensationEvidenceRequest(string Url, string MediaType, string? Caption);
public sealed record CreateCompensationClaimRequest(long BookingId, string IncidentType, string Description, DateTime IncidentAt, IReadOnlyList<CompensationItemRequest> Items, IReadOnlyList<CompensationEvidenceRequest> Evidence);

public static class CompensationRules
{
    public static decimal RequestedAmount(int quantity, decimal unitAmount, decimal depreciationPercent, decimal? maximumPerItem = null)
    {
        if (quantity < 1 || unitAmount <= 0 || depreciationPercent is < 0 or > 100) throw new ArgumentOutOfRangeException(nameof(quantity));
        var amount = decimal.Round(quantity * unitAmount * (100 - depreciationPercent) / 100, 0);
        return maximumPerItem.HasValue ? Math.Min(amount, maximumPerItem.Value * quantity) : amount;
    }
}

[ApiController]
[Authorize]
[Route("api")]
public sealed class CompensationController(AppDbContext db) : ControllerBase
{
    private long UserId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string Role => User.FindFirstValue(ClaimTypes.Role) ?? "";

    [AllowAnonymous]
    [HttpGet("homestays/{homestayId:long}/compensation-catalog")]
    public async Task<IActionResult> PublicCatalog(long homestayId) => Ok(new
    {
        items = await db.CompensationCatalogItems.AsNoTracking().Where(x => x.HomestayId == homestayId && x.IsActive)
            .OrderBy(x => x.Category).ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.Name, x.Category, x.Description, x.Unit, x.ReplacementCost, x.MaximumCompensation, x.DefaultDepreciationPercent, x.EffectiveFrom }).ToListAsync()
    });

    [HttpGet("host/homestays/{homestayId:long}/compensation-catalog")]
    public async Task<IActionResult> Catalog(long homestayId, [FromQuery] bool includeInactive = false)
    {
        if (!await OwnsHomestay(homestayId)) return Forbid();
        var query = db.CompensationCatalogItems.AsNoTracking().Where(x => x.HomestayId == homestayId);
        if (!includeInactive) query = query.Where(x => x.IsActive);
        return Ok(new { items = await query.OrderBy(x => x.Category).ThenBy(x => x.Name).ToListAsync() });
    }

    [HttpPost("host/homestays/{homestayId:long}/compensation-catalog")]
    public async Task<IActionResult> CreateCatalogItem(long homestayId, CompensationCatalogRequest request)
    {
        if (!await OwnsHomestay(homestayId)) return Forbid();
        if (ValidateCatalog(request) is { } error) return BadRequest(new { message = error });
        var now = DateTime.UtcNow;
        var item = new CompensationCatalogItem { HomestayId = homestayId, Name = request.Name.Trim(), Category = request.Category.Trim(), Description = Clean(request.Description), Unit = request.Unit.Trim(), ReplacementCost = request.ReplacementCost, MaximumCompensation = request.MaximumCompensation, DefaultDepreciationPercent = request.DefaultDepreciationPercent, IsActive = request.IsActive, EffectiveFrom = now, CreatedBy = UserId, CreatedAt = now, UpdatedAt = now };
        db.CompensationCatalogItems.Add(item); await db.SaveChangesAsync(); AddAudit("compensation.catalog.created", "CompensationCatalogItem", item.Id, request, null); await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Catalog), new { homestayId }, item);
    }

    [HttpPut("host/compensation-catalog/{id:long}")]
    public async Task<IActionResult> UpdateCatalogItem(long id, CompensationCatalogRequest request)
    {
        var item = await db.CompensationCatalogItems.Include(x => x.Homestay).SingleOrDefaultAsync(x => x.Id == id && x.Homestay.HostId == UserId);
        if (item is null) return NotFound(); if (ValidateCatalog(request) is { } error) return BadRequest(new { message = error });
        item.Name = request.Name.Trim(); item.Category = request.Category.Trim(); item.Description = Clean(request.Description); item.Unit = request.Unit.Trim(); item.ReplacementCost = request.ReplacementCost; item.MaximumCompensation = request.MaximumCompensation; item.DefaultDepreciationPercent = request.DefaultDepreciationPercent; item.IsActive = request.IsActive; item.UpdatedAt = DateTime.UtcNow;
        AddAudit("compensation.catalog.updated", "CompensationCatalogItem", id, request, null); await db.SaveChangesAsync(); return Ok(item);
    }

    [HttpDelete("host/compensation-catalog/{id:long}")]
    public async Task<IActionResult> DisableCatalogItem(long id)
    {
        var item = await db.CompensationCatalogItems.Include(x => x.Homestay).SingleOrDefaultAsync(x => x.Id == id && x.Homestay.HostId == UserId);
        if (item is null) return NotFound(); item.IsActive = false; item.UpdatedAt = DateTime.UtcNow;
        AddAudit("compensation.catalog.disabled", "CompensationCatalogItem", id, new { item.IsActive }, null); await db.SaveChangesAsync(); return NoContent();
    }

    [HttpGet("compensation-claims")]
    public async Task<IActionResult> Claims([FromQuery] string? status = null, [FromQuery] long? bookingId = null)
    {
        var query = ScopedClaims().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        if (bookingId.HasValue) query = query.Where(x => x.BookingId == bookingId);
        var items = await query.OrderByDescending(x => x.UpdatedAt).Select(x => new { x.Id, x.BookingId, x.Booking.BookingCode, homestayName = x.Booking.Homestay.Name, x.IncidentType, status = x.AdditionalCharge != null && x.AdditionalCharge.IsPaid ? CompensationStatus.Paid : x.Status, x.RequestedAmount, x.ApprovedAmount, x.ResponseDueAt, x.SubmittedAt, x.UpdatedAt }).ToListAsync();
        return Ok(new { items });
    }

    [HttpGet("compensation-claims/{id:long}")]
    public async Task<IActionResult> Claim(long id)
    {
        var claim = await ScopedClaims().AsNoTracking().Include(x => x.AdditionalCharge).Include(x => x.Items).Include(x => x.Evidence).SingleOrDefaultAsync(x => x.Id == id);
        return claim is null ? NotFound() : Ok(ToDetail(claim));
    }

    [HttpPost("host/compensation-claims")]
    public async Task<IActionResult> CreateClaim(CreateCompensationClaimRequest request)
    {
        if (Role != "Host") return Forbid();
        var booking = await db.Bookings.Include(x => x.Homestay).SingleOrDefaultAsync(x => x.Id == request.BookingId && x.Homestay.HostId == UserId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy booking thuộc homestay của bạn." });
        if (booking.Status is not (BookingStatus.CheckedIn or BookingStatus.CheckedOut or BookingStatus.CheckoutPendingPayment)) return Conflict(new { message = "Chỉ lập bồi thường cho booking đã check-in hoặc checkout." });
        if (string.IsNullOrWhiteSpace(request.Description) || string.IsNullOrWhiteSpace(request.IncidentType) || request.Items.Count == 0) return BadRequest(new { message = "Phải có loại sự cố, mô tả và ít nhất một tài sản." });
        if (request.IncidentAt > DateTime.UtcNow.AddMinutes(5)) return BadRequest(new { message = "Thời điểm sự cố không hợp lệ." });

        var catalogIds = request.Items.Where(x => x.CatalogItemId.HasValue).Select(x => x.CatalogItemId!.Value).Distinct().ToList();
        var catalog = await db.CompensationCatalogItems.Where(x => catalogIds.Contains(x.Id) && x.HomestayId == booking.HomestayId).ToDictionaryAsync(x => x.Id);
        if (catalog.Count != catalogIds.Count) return BadRequest(new { message = "Danh mục tài sản không thuộc homestay này." });
        var now = DateTime.UtcNow;
        var claim = new CompensationClaim { BookingId = booking.Id, Status = CompensationStatus.Draft, IncidentType = request.IncidentType.Trim(), Description = request.Description.Trim(), IncidentAt = request.IncidentAt, CreatedBy = UserId, CreatedAt = now, UpdatedAt = now };
        foreach (var input in request.Items)
        {
            if (input.Quantity < 1 || input.Quantity > 100) return BadRequest(new { message = "Số lượng tài sản không hợp lệ." });
            var source = input.CatalogItemId.HasValue ? catalog[input.CatalogItemId.Value] : null;
            var name = source?.Name ?? input.ItemName?.Trim(); var category = source?.Category ?? input.Category?.Trim();
            var unitAmount = input.UnitAmount ?? source?.ReplacementCost ?? 0; var depreciation = input.DepreciationPercent ?? source?.DefaultDepreciationPercent ?? 0;
            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(category) || unitAmount <= 0 || depreciation is < 0 or > 100) return BadRequest(new { message = "Thông tin tài sản hoặc mức bồi thường không hợp lệ." });
            var amount = CompensationRules.RequestedAmount(input.Quantity, unitAmount, depreciation, source?.MaximumCompensation);
            claim.Items.Add(new CompensationClaimItem { CatalogItemId = source?.Id, ItemName = name, Category = category, DamageLevel = input.DamageLevel.Trim(), Quantity = input.Quantity, UnitAmount = unitAmount, DepreciationPercent = depreciation, RequestedAmount = amount, Note = Clean(input.Note) });
        }
        foreach (var evidence in request.Evidence)
        {
            if (ValidateEvidence(evidence) is { } evidenceError) return BadRequest(new { message = evidenceError });
            claim.Evidence.Add(CreateEvidence(evidence));
        }
        claim.RequestedAmount = claim.Items.Sum(x => x.RequestedAmount); db.CompensationClaims.Add(claim); await db.SaveChangesAsync();
        AddAudit("compensation.claim.created", "CompensationClaim", claim.Id, new { claim.BookingId, claim.RequestedAmount }, null); await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Claim), new { id = claim.Id }, ToDetail(claim));
    }

    [HttpDelete("host/compensation-claims/{id:long}")]
    public async Task<IActionResult> DeleteDraft(long id)
    {
        var claim = await HostClaim(id).SingleOrDefaultAsync();
        if (claim is null) return NotFound();
        if (claim.Status != CompensationStatus.Draft) return Conflict(new { message = "Chỉ có thể xóa hồ sơ nháp." });
        db.CompensationClaims.Remove(claim); AddAudit("compensation.claim.deleted", "CompensationClaim", id, new { claim.BookingId }, null); await db.SaveChangesAsync(); return NoContent();
    }

    [HttpPost("host/compensation-claims/{id:long}/submit")]
    public async Task<IActionResult> Submit(long id)
    {
        var claim = await HostClaim(id).Include(x => x.Evidence).Include(x => x.Items).SingleOrDefaultAsync();
        if (claim is null) return NotFound(); if (claim.Status != CompensationStatus.Draft) return Conflict(new { message = "Chỉ có thể gửi hồ sơ nháp." });
        if (claim.Evidence.Count == 0) return BadRequest(new { message = "Phải có ít nhất một bằng chứng ảnh hoặc video." });
        claim.Status = CompensationStatus.PendingConfirmation; claim.SubmittedAt = DateTime.UtcNow; claim.ResponseDueAt = DateTime.UtcNow.AddHours(48); claim.UpdatedAt = DateTime.UtcNow;
        AddAudit("compensation.claim.submitted", "CompensationClaim", id, new { claim.RequestedAmount, claim.ResponseDueAt }, null); await db.SaveChangesAsync(); return Ok(ToDetail(claim));
    }

    [HttpPost("compensation-claims/{id:long}/accept")]
    public async Task<IActionResult> Accept(long id)
    {
        var claim = await CustomerClaim(id).Include(x => x.Evidence).SingleOrDefaultAsync();
        if (claim is null) return NotFound(); if (claim.Status != CompensationStatus.PendingConfirmation) return Conflict(new { message = "Hồ sơ không chờ khách xác nhận." });
        claim.ConfirmedAt = DateTime.UtcNow; return await ConfirmClaim(claim);
    }

    [HttpPost("host/compensation-claims/{id:long}/withdraw")]
    public async Task<IActionResult> Withdraw(long id)
    {
        var claim = await HostClaim(id).SingleOrDefaultAsync(); if (claim is null) return NotFound();
        if (claim.Status != CompensationStatus.PendingConfirmation) return Conflict(new { message = "Chỉ có thể thu hồi hồ sơ đang chờ khách xác nhận." });
        claim.Status = CompensationStatus.Withdrawn; claim.UpdatedAt = DateTime.UtcNow;
        AddAudit("compensation.claim.withdrawn", "CompensationClaim", id, new { claim.Status }, null); await db.SaveChangesAsync(); return Ok(new { claim.Id, claim.Status });
    }

    private IQueryable<CompensationClaim> ScopedClaims()
    {
        var query = db.CompensationClaims.AsQueryable();
        return Role switch { "Host" => query.Where(x => x.Booking.Homestay.HostId == UserId), "Customer" => query.Where(x => x.Booking.CustomerId == UserId && x.Status != CompensationStatus.Draft), "Admin" or "Support" => query, _ => query.Where(_ => false) };
    }
    private IQueryable<CompensationClaim> HostClaim(long id) => db.CompensationClaims.Where(x => x.Id == id && x.Booking.Homestay.HostId == UserId);
    private IQueryable<CompensationClaim> CustomerClaim(long id) => db.CompensationClaims.Where(x => x.Id == id && x.Booking.CustomerId == UserId);
    private Task<bool> OwnsHomestay(long id) => Role == "Host" ? db.Homestays.AnyAsync(x => x.Id == id && x.HostId == UserId) : Task.FromResult(false);

    private async Task<IActionResult> ConfirmClaim(CompensationClaim claim)
    {
        if (claim.AdditionalChargeId.HasValue) return Conflict(new { message = "Hồ sơ đã phát sinh khoản phải thu." });
        var amount = claim.RequestedAmount; claim.ApprovedAmount = amount; claim.UpdatedAt = DateTime.UtcNow;
        var evidenceJson = JsonSerializer.Serialize(claim.Evidence.Select(x => new { x.Url, x.MediaType, x.Caption }));
        var charge = new AdditionalCharge { BookingId = claim.BookingId, Type = "compensation", Description = $"Bồi thường: {claim.Description}", Quantity = 1, UnitPrice = amount, TotalPrice = amount, IsPaid = false, Status = ChargeStatus.Approved, EvidenceJson = evidenceJson, ReviewedBy = UserId, ReviewReason = "Khách đã xác nhận.", ReviewedAt = DateTime.UtcNow, RecordedBy = claim.CreatedBy, CreatedAt = DateTime.UtcNow };
        db.AdditionalCharges.Add(charge); await db.SaveChangesAsync(); claim.AdditionalChargeId = charge.Id; claim.Status = CompensationStatus.PaymentPending;
        var invoice = await db.FinalInvoices.SingleOrDefaultAsync(x => x.BookingId == claim.BookingId);
        if (invoice is not null) { invoice.AdditionalChargesAmount += amount; invoice.BalanceDue += amount; invoice.Status = "Due"; invoice.PaidAt = null; }
        await db.Bookings.Where(x => x.Id == claim.BookingId).ExecuteUpdateAsync(x => x.SetProperty(b => b.PaymentStatus, PaymentStatus.PartiallyPaid).SetProperty(b => b.UpdatedAt, DateTime.UtcNow));
        AddAudit("compensation.claim.confirmed", "CompensationClaim", claim.Id, new { amount, claim.AdditionalChargeId }, null); await db.SaveChangesAsync(); return Ok(new { claim.Id, claim.Status, claim.ApprovedAmount, claim.AdditionalChargeId });
    }

    private static object ToDetail(CompensationClaim x) => new { x.Id, x.BookingId, status = x.AdditionalCharge?.IsPaid == true ? CompensationStatus.Paid : x.Status, x.IncidentType, x.Description, x.IncidentAt, x.RequestedAmount, x.ApprovedAmount, x.ResponseDueAt, x.SubmittedAt, x.ConfirmedAt, x.AdditionalChargeId, x.CreatedAt, x.UpdatedAt, items = x.Items.Select(i => new { i.Id, i.CatalogItemId, i.ItemName, i.Category, i.DamageLevel, i.Quantity, i.UnitAmount, i.DepreciationPercent, i.RequestedAmount, i.Note }), evidence = x.Evidence.Select(e => new { e.Id, e.Url, e.MediaType, e.Caption, e.CreatedAt }) };
    private CompensationEvidence CreateEvidence(CompensationEvidenceRequest input) => new() { Url = input.Url.Trim(), MediaType = input.MediaType, Caption = Clean(input.Caption), UploadedBy = UserId, CreatedAt = DateTime.UtcNow };
    private static string? ValidateEvidence(CompensationEvidenceRequest x) => string.IsNullOrWhiteSpace(x.Url) || !Uri.TryCreate(x.Url, UriKind.RelativeOrAbsolute, out _) || x.Url.Length > 1000 || x.MediaType is not ("image" or "video" or "document") ? "Bằng chứng không hợp lệ." : null;
    private static string? ValidateCatalog(CompensationCatalogRequest x) => string.IsNullOrWhiteSpace(x.Name) || string.IsNullOrWhiteSpace(x.Category) || string.IsNullOrWhiteSpace(x.Unit) ? "Tên, nhóm và đơn vị là bắt buộc." : x.ReplacementCost <= 0 || x.MaximumCompensation <= 0 || x.MaximumCompensation > x.ReplacementCost || x.DefaultDepreciationPercent is < 0 or > 100 ? "Giá trị hoặc tỷ lệ khấu hao không hợp lệ." : null;
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private void AddAudit(string action, string targetType, long targetId, object after, string? reason) => db.AuditLogs.Add(new AuditLog { ActorId = UserId, ActorRole = Role, Action = action, TargetType = targetType, TargetId = targetId.ToString(), AfterJson = JsonSerializer.Serialize(after), Reason = Clean(reason), Ip = HttpContext.Connection.RemoteIpAddress, CreatedAt = DateTime.UtcNow });
}
