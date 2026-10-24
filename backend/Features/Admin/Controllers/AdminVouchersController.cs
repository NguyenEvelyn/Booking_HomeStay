using System.Security.Claims;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Admin.Audit;
using HomestayAuth.Api.Features.Admin.Authorization;
using HomestayAuth.Api.Features.Bookings;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Admin.Controllers;

public sealed record VoucherRequest(string Code, string Name, string? Description, string DiscountType, decimal DiscountValue,
    decimal? MaximumDiscount, decimal MinimumBookingAmount, DateTime ValidFrom, DateTime ValidUntil, int? UsageLimit,
    int UsageLimitPerCustomer, long? HomestayId, string Status, string FundedBy = VoucherFunding.Platform, bool IsPublic = true);

[ApiController, Route("api/admin/vouchers"), Authorize(Policy = AdminPolicies.FullAccess)]
public sealed class AdminVouchersController(AppDbContext db, IAuditLogService audit, VoucherService voucherService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? search, [FromQuery] string? status, CancellationToken ct)
    {
        var query = db.Vouchers.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search)) { var q = search.Trim().ToLower(); query = query.Where(x => x.Code.ToLower().Contains(q) || x.Name.ToLower().Contains(q)); }
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Select(x => new { Voucher = x,
            HomestayName = x.HomestayId == null ? null : db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.Name).FirstOrDefault(),
            HasUsage = db.VoucherUsages.Any(u => u.VoucherId == x.Id) }).ToListAsync(ct);
        // Statistics only count real uses (see VoucherService.CountedUsages), not abandoned holds.
        var stats = await voucherService.CountedUsages(DateTime.UtcNow)
            .Join(db.Bookings, u => u.BookingId, b => b.Id, (u, b) => new { u.VoucherId, u.DiscountAmount, b.TotalAmount })
            .GroupBy(x => x.VoucherId)
            .Select(g => new { VoucherId = g.Key, Count = g.Count(), Discount = g.Sum(x => x.DiscountAmount), Revenue = g.Sum(x => x.TotalAmount) })
            .ToDictionaryAsync(x => x.VoucherId, ct);
        var items = rows.Select(r =>
        {
            var x = r.Voucher; var s = stats.GetValueOrDefault(x.Id);
            return new { x.Id, x.Code, x.Name, x.Description, x.DiscountType, x.DiscountValue, x.MaximumDiscount, x.MinimumBookingAmount,
                x.ValidFrom, x.ValidUntil, x.UsageLimit, x.UsageLimitPerCustomer, x.HomestayId, homestayName = r.HomestayName,
                x.FundedBy, x.IsPublic, x.Status, usageCount = s?.Count ?? 0, totalDiscount = s?.Discount ?? 0, bookingRevenue = s?.Revenue ?? 0,
                pricingLocked = r.HasUsage, x.CreatedAt, x.UpdatedAt };
        });
        return Ok(new { items });
    }

    [HttpGet("{id:long}/usages")]
    public async Task<IActionResult> Usages(long id, CancellationToken ct)
    {
        var counted = voucherService.CountedUsages(DateTime.UtcNow).Where(u => u.VoucherId == id).Select(u => u.Id);
        var items = await db.VoucherUsages.AsNoTracking().Where(u => u.VoucherId == id).OrderByDescending(u => u.UsedAt)
            .Select(u => new { u.Id, u.BookingId, u.UsedAt, u.DiscountAmount, u.FundedBy,
                BookingCode = db.Bookings.Where(b => b.Id == u.BookingId).Select(b => b.BookingCode).FirstOrDefault(),
                BookingStatus = db.Bookings.Where(b => b.Id == u.BookingId).Select(b => b.Status).FirstOrDefault(),
                Customer = db.Users.Where(c => c.Id == u.CustomerId).Select(c => c.FullName).FirstOrDefault(),
                Counted = counted.Contains(u.Id) })
            .Take(200).ToListAsync(ct);
        return Ok(new { items });
    }

    [HttpPost]
    public async Task<IActionResult> Create(VoucherRequest request, CancellationToken ct)
    {
        var error = await Validate(request, null, ct); if (error is not null) return BadRequest(new { message = error });
        var now = DateTime.UtcNow;
        var row = new Voucher { Code = Normalize(request.Code), Name = request.Name.Trim(), Description = request.Description?.Trim(),
            DiscountType = request.DiscountType, DiscountValue = request.DiscountValue, MaximumDiscount = request.MaximumDiscount,
            MinimumBookingAmount = request.MinimumBookingAmount, ValidFrom = request.ValidFrom.ToUniversalTime(), ValidUntil = request.ValidUntil.ToUniversalTime(),
            UsageLimit = request.UsageLimit, UsageLimitPerCustomer = request.UsageLimitPerCustomer, HomestayId = request.HomestayId,
            FundedBy = request.FundedBy, IsPublic = request.IsPublic,
            Status = request.Status, CreatedBy = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!), CreatedAt = now, UpdatedAt = now };
        db.Vouchers.Add(row); audit.Add(HttpContext, "voucher.create", "voucher", row.Code, null, row, "Admin phát hành voucher");
        await db.SaveChangesAsync(ct); return Ok(new { message = "Đã phát hành voucher.", id = row.Id });
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, VoucherRequest request, CancellationToken ct)
    {
        var row = await db.Vouchers.SingleOrDefaultAsync(x => x.Id == id, ct); if (row is null) return NotFound(new { message = "Không tìm thấy voucher." });
        var error = await Validate(request, id, ct); if (error is not null) return BadRequest(new { message = error });
        // Once a booking used the voucher, anything that defines its price or who pays for it is frozen so
        // past bookings stay explainable; only lifetime, limits, visibility and wording can still change.
        if (await db.VoucherUsages.AnyAsync(u => u.VoucherId == id, ct) && PricingChanged(row, request))
            return Conflict(new { message = "Voucher đã được sử dụng nên không thể đổi mã, mức giảm, điều kiện, homestay, bên chịu chi phí hoặc ngày bắt đầu. Hãy tạm ngưng và phát hành voucher mới." });
        var counted = await voucherService.CountedUsages(DateTime.UtcNow).CountAsync(u => u.VoucherId == id, ct);
        if (request.UsageLimit.HasValue && request.UsageLimit < counted)
            return BadRequest(new { message = $"Giới hạn lượt dùng không được nhỏ hơn số lượt đã dùng ({counted})." });
        var before = new { row.Code, row.Name, row.Status, row.DiscountValue, row.ValidUntil, row.UsageLimit, row.IsPublic };
        row.Code = Normalize(request.Code); row.Name = request.Name.Trim(); row.Description = request.Description?.Trim(); row.DiscountType = request.DiscountType;
        row.DiscountValue = request.DiscountValue; row.MaximumDiscount = request.MaximumDiscount; row.MinimumBookingAmount = request.MinimumBookingAmount;
        row.ValidFrom = request.ValidFrom.ToUniversalTime(); row.ValidUntil = request.ValidUntil.ToUniversalTime(); row.UsageLimit = request.UsageLimit;
        row.UsageLimitPerCustomer = request.UsageLimitPerCustomer; row.HomestayId = request.HomestayId; row.FundedBy = request.FundedBy; row.IsPublic = request.IsPublic;
        row.Status = request.Status; row.UpdatedAt = DateTime.UtcNow;
        audit.Add(HttpContext, "voucher.update", "voucher", id.ToString(), before, row, "Admin cập nhật voucher");
        await db.SaveChangesAsync(ct); return Ok(new { message = "Đã cập nhật voucher." });
    }

    [HttpPatch("{id:long}/status")]
    public async Task<IActionResult> Status(long id, [FromBody] VoucherStatusRequest request, CancellationToken ct)
    {
        if (request.Status is not ("Active" or "Inactive")) return BadRequest(new { message = "Trạng thái không hợp lệ." });
        var row = await db.Vouchers.SingleOrDefaultAsync(x => x.Id == id, ct); if (row is null) return NotFound(new { message = "Không tìm thấy voucher." });
        var before = row.Status; row.Status = request.Status; row.UpdatedAt = DateTime.UtcNow;
        audit.Add(HttpContext, "voucher.status", "voucher", id.ToString(), before, row.Status, "Admin đổi trạng thái voucher");
        await db.SaveChangesAsync(ct); return Ok(new { message = request.Status == "Active" ? "Đã kích hoạt voucher." : "Đã tạm ngưng voucher." });
    }

    public static bool PricingChanged(Voucher row, VoucherRequest x) =>
        row.Code != Normalize(x.Code) || row.DiscountType != x.DiscountType || row.DiscountValue != x.DiscountValue
        || row.MaximumDiscount != x.MaximumDiscount || row.MinimumBookingAmount != x.MinimumBookingAmount
        || row.HomestayId != x.HomestayId || row.FundedBy != x.FundedBy
        || Math.Abs((row.ValidFrom - x.ValidFrom.ToUniversalTime()).TotalMinutes) >= 1;

    private async Task<string?> Validate(VoucherRequest x, long? id, CancellationToken ct)
    {
        var code = Normalize(x.Code);
        if (code.Length is < 3 or > 50 || code.Any(c => !char.IsLetterOrDigit(c) && c is not '-' and not '_')) return "Mã voucher phải dài 3–50 ký tự và chỉ gồm chữ, số, '-' hoặc '_'.";
        if (string.IsNullOrWhiteSpace(x.Name) || x.Name.Trim().Length > 150) return "Tên voucher không hợp lệ.";
        if (x.DiscountType is not ("Percentage" or "FixedAmount")) return "Loại giảm giá không hợp lệ.";
        if (x.DiscountValue <= 0 || (x.DiscountType == "Percentage" && x.DiscountValue > 100)) return "Giá trị giảm không hợp lệ.";
        if (x.MaximumDiscount < 0 || x.MinimumBookingAmount < 0 || x.UsageLimit is <= 0 || x.UsageLimitPerCustomer <= 0) return "Điều kiện sử dụng không hợp lệ.";
        if (x.ValidUntil.ToUniversalTime() <= x.ValidFrom.ToUniversalTime()) return "Thời gian kết thúc phải sau thời gian bắt đầu.";
        if (x.Status is not ("Active" or "Inactive")) return "Trạng thái không hợp lệ.";
        if (x.FundedBy is not (VoucherFunding.Platform or VoucherFunding.Host)) return "Bên chịu chi phí giảm giá không hợp lệ.";
        // A host only pays for promotions on their own homestay.
        if (x.FundedBy == VoucherFunding.Host && !x.HomestayId.HasValue) return "Voucher do Host chịu chi phí phải gắn với một homestay cụ thể.";
        if (x.HomestayId.HasValue && !await db.Homestays.AnyAsync(h => h.Id == x.HomestayId, ct)) return "Homestay áp dụng không tồn tại.";
        if (await db.Vouchers.AnyAsync(v => v.Code == code && v.Id != id, ct)) return "Mã voucher đã tồn tại.";
        return null;
    }
    private static string Normalize(string? code) => (code ?? "").Trim().ToUpperInvariant();
}

public sealed record VoucherStatusRequest(string Status);

[ApiController, Route("api/vouchers")]
public sealed class VouchersController(AppDbContext db) : ControllerBase
{
    [AllowAnonymous, HttpGet]
    public async Task<IActionResult> Active([FromQuery] long? homestayId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var items = await db.Vouchers.AsNoTracking().Where(x => x.Status == "Active" && x.IsPublic && x.ValidFrom <= now && x.ValidUntil >= now
            && (!homestayId.HasValue || x.HomestayId == null || x.HomestayId == homestayId))
            .OrderBy(x => x.ValidUntil).Select(x => new { x.Id, x.Code, x.Name, x.Description, x.DiscountType, x.DiscountValue,
                x.MaximumDiscount, x.MinimumBookingAmount, x.ValidFrom, x.ValidUntil, x.HomestayId,
                homestayName = x.HomestayId == null ? null : db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.Name).FirstOrDefault() })
            .ToListAsync(ct);
        return Ok(new { items });
    }
}
