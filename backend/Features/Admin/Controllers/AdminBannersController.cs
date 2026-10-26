using HomestayAuth.Api.Features.Notifications;
using System.Security.Claims;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Admin.Audit;
using HomestayAuth.Api.Features.Admin.Authorization;
using HomestayAuth.Api.Features.Bookings;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Admin.Controllers;

public sealed record BannerRequest(string Title, string? Subtitle, string ImageUrl, string Placement, string TargetType, long? TargetId,
    string? TargetQuery, DateTime StartsAt, DateTime EndsAt, int Priority, string Status);
public sealed record BannerStatusRequest(string Status, string? Note);

[ApiController, Route("api/admin/banners"), Authorize(Policy = AdminPolicies.Access)]
public sealed class AdminBannersController(AppDbContext db, IAuditLogService audit, SupabaseStorageService storage, NotificationService notifications) : ControllerBase
{
    private long UserId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status)
    {
        var now = DateTime.UtcNow;
        var query = db.Banners.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        var items = await query.OrderBy(x => x.Status == BannerStatus.Pending ? 0 : 1).ThenByDescending(x => x.Priority).ThenByDescending(x => x.StartsAt).Take(200)
            .Select(x => new { x.Id, x.Title, x.Subtitle, x.ImageUrl, x.Placement, x.TargetType, x.TargetId, x.TargetQuery, x.StartsAt, x.EndsAt,
                x.Priority, x.Status, x.ReviewNote, x.RequestedBy, x.CreatedAt,
                requestedByName = db.Users.Where(u => u.Id == x.RequestedBy).Select(u => u.FullName).FirstOrDefault(),
                live = x.Status == BannerStatus.Active && x.StartsAt <= now && now < x.EndsAt })
            .ToListAsync();
        return Ok(new { items });
    }

    [HttpPost("upload"), Authorize(Policy = AdminPolicies.FullAccess), RequestSizeLimit(ImageUpload.MaxBytes)]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length == 0 || file.Length > ImageUpload.MaxBytes) return BadRequest(new { message = "Ảnh phải nhỏ hơn 8 MB." });
        if (await ImageUpload.Validate(file, cancellationToken) is not (var extension, var contentType))
            return BadRequest(new { message = "Chỉ hỗ trợ JPG, PNG hoặc WEBP hợp lệ." });
        await using var stream = file.OpenReadStream();
        var url = await storage.UploadPublicImageAsync(stream, $"banners/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{extension}", contentType, cancellationToken);
        return Ok(new { url });
    }

    [HttpPost, Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> Create(BannerRequest request)
    {
        if (await Validate(request) is { } error) return BadRequest(new { message = error });
        var now = DateTime.UtcNow;
        var banner = new Banner { Title = request.Title.Trim(), Subtitle = request.Subtitle?.Trim(), ImageUrl = request.ImageUrl.Trim(), Placement = request.Placement,
            TargetType = request.TargetType, TargetId = request.TargetType == BannerTarget.Search ? null : request.TargetId,
            TargetQuery = request.TargetType == BannerTarget.Search ? request.TargetQuery?.Trim() : null,
            StartsAt = request.StartsAt.ToUniversalTime(), EndsAt = request.EndsAt.ToUniversalTime(), Priority = request.Priority,
            Status = request.Status, CreatedBy = UserId, CreatedAt = now, UpdatedAt = now };
        db.Banners.Add(banner);
        audit.Add(HttpContext, "banner.create", "banner", banner.Title, null, new { banner.Placement, banner.TargetType, banner.TargetId, banner.StartsAt, banner.EndsAt }, "Admin tạo banner");
        await db.SaveChangesAsync();
        return Ok(new { banner.Id, message = "Đã tạo banner." });
    }

    [HttpPut("{id:long}"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> Update(long id, BannerRequest request)
    {
        var banner = await db.Banners.SingleOrDefaultAsync(x => x.Id == id);
        if (banner is null) return NotFound(new { message = "Không tìm thấy banner." });
        if (await Validate(request) is { } error) return BadRequest(new { message = error });
        banner.Title = request.Title.Trim(); banner.Subtitle = request.Subtitle?.Trim(); banner.ImageUrl = request.ImageUrl.Trim(); banner.Placement = request.Placement;
        banner.TargetType = request.TargetType; banner.TargetId = request.TargetType == BannerTarget.Search ? null : request.TargetId;
        banner.TargetQuery = request.TargetType == BannerTarget.Search ? request.TargetQuery?.Trim() : null;
        banner.StartsAt = request.StartsAt.ToUniversalTime(); banner.EndsAt = request.EndsAt.ToUniversalTime(); banner.Priority = request.Priority;
        banner.Status = request.Status; banner.UpdatedAt = DateTime.UtcNow;
        audit.Add(HttpContext, "banner.update", "banner", id.ToString(), null, new { banner.Status, banner.StartsAt, banner.EndsAt }, "Admin cập nhật banner");
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật banner." });
    }

    // Approve/reject a host's deal promotion request, or switch any banner on/off.
    [HttpPatch("{id:long}/status"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> SetStatus(long id, BannerStatusRequest request)
    {
        if (request.Status is not (BannerStatus.Active or BannerStatus.Inactive or BannerStatus.Rejected)) return BadRequest(new { message = "Trạng thái không hợp lệ." });
        var banner = await db.Banners.SingleOrDefaultAsync(x => x.Id == id);
        if (banner is null) return NotFound(new { message = "Không tìm thấy banner." });
        if (request.Status == BannerStatus.Rejected && string.IsNullOrWhiteSpace(request.Note)) return BadRequest(new { message = "Vui lòng ghi lý do từ chối." });
        var before = banner.Status;
        banner.Status = request.Status; banner.ReviewNote = request.Note?.Trim(); banner.UpdatedAt = DateTime.UtcNow;
        // A host proposal is decided once: tell the host whether the deal made it onto the home page.
        if (banner.RequestedBy is { } hostId && before == BannerStatus.Pending && request.Status is BannerStatus.Active or BannerStatus.Rejected)
            notifications.Notify(hostId, NotificationTemplates.BannerDecision(banner.Title, request.Status == BannerStatus.Active, banner.ReviewNote));
        audit.Add(HttpContext, $"banner.{request.Status.ToLowerInvariant()}", "banner", id.ToString(), before, banner.Status, request.Note);
        await db.SaveChangesAsync();
        return Ok(new { message = request.Status switch { BannerStatus.Active => "Banner đang hiển thị.", BannerStatus.Rejected => "Đã từ chối đề xuất.", _ => "Đã ẩn banner." } });
    }

    private async Task<string?> Validate(BannerRequest x)
    {
        if (BannerRules.Validate(x.Title, x.Subtitle, x.ImageUrl, x.Placement, x.TargetType, x.TargetId, x.TargetQuery,
                x.StartsAt.ToUniversalTime(), x.EndsAt.ToUniversalTime(), x.Priority) is { } error) return error;
        if (x.Status is not (BannerStatus.Active or BannerStatus.Inactive)) return "Trạng thái không hợp lệ.";
        return x.TargetType switch
        {
            BannerTarget.Deal when !await db.RoomDeals.AnyAsync(d => d.Id == x.TargetId && d.Status == RoomDealStatus.Active) => "Deal không tồn tại hoặc đã kết thúc.",
            BannerTarget.Homestay when !await db.Homestays.AnyAsync(h => h.Id == x.TargetId && h.Status == "Approved") => "Homestay không tồn tại hoặc chưa được duyệt.",
            BannerTarget.Voucher when !await db.Vouchers.AnyAsync(v => v.Id == x.TargetId && v.IsPublic && v.Status == "Active") => "Chỉ liên kết tới voucher công khai đang hoạt động.",
            _ => null
        };
    }
}

[ApiController, Route("api/home/banners")]
public sealed class HomeBannersController(AppDbContext db, DealService deals) : ControllerBase
{
    // Live banners for a placement; each one is returned only while its target is still valid.
    [AllowAnonymous, HttpGet]
    public async Task<IActionResult> Live([FromQuery] string placement = BannerPlacement.HomeHero)
    {
        var now = DateTime.UtcNow; var today = BookingRules.Today;
        var banners = await db.Banners.AsNoTracking()
            .Where(x => x.Placement == placement && x.Status == BannerStatus.Active && x.StartsAt <= now && x.EndsAt > now)
            .OrderByDescending(x => x.Priority).ThenByDescending(x => x.StartsAt).Take(10).ToListAsync();
        var items = new List<object>();
        foreach (var b in banners)
        {
            object? link = b.TargetType switch
            {
                BannerTarget.Deal => await DealLink(b.TargetId!.Value, now, today),
                BannerTarget.Homestay => await db.Homestays.AnyAsync(h => h.Id == b.TargetId && h.Status == "Approved") ? new { type = BannerTarget.Homestay, homestayId = b.TargetId } : null,
                BannerTarget.Voucher => await db.Vouchers.Where(v => v.Id == b.TargetId && v.IsPublic && v.Status == "Active" && v.ValidFrom <= now && v.ValidUntil > now)
                    .Select(v => new { type = BannerTarget.Voucher, code = v.Code, homestayId = v.HomestayId }).FirstOrDefaultAsync(),
                BannerTarget.Search => new { type = BannerTarget.Search, province = b.TargetQuery },
                _ => null
            };
            if (link is null) continue;
            items.Add(new { b.Id, b.Title, b.Subtitle, b.ImageUrl, b.EndsAt, link });
            if (items.Count == 5) break;
        }
        return Ok(new { items });
    }

    private async Task<object?> DealLink(long dealId, DateTime now, DateOnly today)
    {
        var deal = await db.RoomDeals.AsNoTracking().Where(d => d.Id == dealId && d.Status == RoomDealStatus.Active && d.SaleEndsAt > now && d.EndDate > today
            && d.Homestay.Status == "Approved").SingleOrDefaultAsync();
        if (deal is null || deal.RoomsLimit - await deals.SoldRooms(deal.Id, now) <= 0) return null;
        var checkIn = deal.StartDate > today ? deal.StartDate : today;
        return new { type = BannerTarget.Deal, homestayId = deal.HomestayId, deal.RoomTypeId, checkIn, checkOut = checkIn.AddDays(1), deal.DiscountPercent, deal.SaleEndsAt };
    }
}
