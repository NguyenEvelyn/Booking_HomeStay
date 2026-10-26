using HomestayAuth.Api.Features.Notifications;
using System.Security.Claims;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record CreateDealRequest(long RoomTypeId, DateOnly StartDate, DateOnly EndDate, decimal DiscountPercent, int RoomsLimit,
    DateTime? SaleEndsAt = null, bool AllowVoucher = false, long? SourceBookingId = null);
public sealed record PromoteDealRequest(string? Title, string? Subtitle);

[ApiController, Route("api/host/deals"), Authorize(Roles = "Host")]
public sealed class HostDealsController(AppDbContext db, DealService deals, NotificationService notifications) : ControllerBase
{
    private long HostId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var now = DateTime.UtcNow;
        var rows = await db.RoomDeals.AsNoTracking().Where(x => x.Homestay.HostId == HostId)
            .OrderByDescending(x => x.Status == RoomDealStatus.Active && x.SaleEndsAt > now).ThenByDescending(x => x.CreatedAt).Take(100)
            .Select(x => new { Deal = x, HomestayName = x.Homestay.Name, RoomTypeName = x.RoomType.Name, x.RoomType.BasePrice }).ToListAsync();
        var items = new List<object>();
        foreach (var r in rows)
        {
            var sold = await deals.SoldRooms(r.Deal.Id, now);
            var revenue = await deals.SoldBookings(r.Deal.Id, now).SumAsync(b => (decimal?)b.TotalAmount) ?? 0;
            var live = r.Deal.Status == RoomDealStatus.Active && r.Deal.SaleEndsAt > now;
            items.Add(new { r.Deal.Id, r.Deal.HomestayId, homestayName = r.HomestayName, r.Deal.RoomTypeId, roomTypeName = r.RoomTypeName,
                r.Deal.StartDate, r.Deal.EndDate, r.Deal.DiscountPercent, basePrice = r.BasePrice,
                estimatedPrice = DealRules.EstimatedNightlyPrice(r.BasePrice, r.Deal.DiscountPercent),
                r.Deal.RoomsLimit, sold, remaining = Math.Max(0, r.Deal.RoomsLimit - sold), revenue, r.Deal.SaleEndsAt, r.Deal.AllowVoucher,
                r.Deal.Source, status = live ? "Active" : "Ended", r.Deal.CreatedAt });
        }
        return Ok(new { items });
    }

    // Pre-filled deal for the room a no-show just released: tonight (or from check-in) up to the original check-out.
    [HttpGet("suggestion")]
    public async Task<IActionResult> Suggestion([FromQuery] long bookingId)
    {
        var booking = await db.Bookings.AsNoTracking().Include(x => x.Details)
            .SingleOrDefaultAsync(x => x.Id == bookingId && x.Homestay.HostId == HostId && x.Status == BookingStatus.NoShow);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn không đến của bạn." });
        var roomTypeId = booking.Details.Select(d => d.RoomTypeId).FirstOrDefault();
        var zone = await Zone(booking.HomestayId);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone));
        var start = booking.CheckInDate > today ? booking.CheckInDate : today;
        var end = booking.CheckOutDate < start.AddDays(DealRules.MaxNights) ? booking.CheckOutDate : start.AddDays(DealRules.MaxNights);
        if (end <= start || start.DayNumber - today.DayNumber > DealRules.MaxDaysAhead)
            return Ok(new { available = false, message = "Không còn đêm nào phù hợp để tạo deal phút chót cho phòng này." });
        var free = (await BookingAvailability.AvailableRoomIds(db, roomTypeId, start, end, DateTime.UtcNow)).Count;
        return Ok(new { available = free > 0, roomTypeId, startDate = start, endDate = end, discountPercent = 30m,
            roomsLimit = Math.Max(1, Math.Min(free, booking.Details.Sum(d => d.Quantity))),
            saleEndsAt = DealRules.DefaultSaleEndUtc(start, zone, DateTime.UtcNow), sourceBookingId = booking.Id,
            message = free > 0 ? null : "Phòng đã được đặt lại, không cần tạo deal." });
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateDealRequest request)
    {
        var roomType = await db.RoomTypes.AsNoTracking().Where(x => x.Id == request.RoomTypeId && x.Homestay.HostId == HostId)
            .Select(x => new { x.Id, x.HomestayId, x.Status, HomestayStatus = x.Homestay.Status }).SingleOrDefaultAsync();
        if (roomType is null) return NotFound(new { message = "Không tìm thấy loại phòng của bạn." });
        if (roomType.Status != "Active" || roomType.HomestayStatus != "Approved") return BadRequest(new { message = "Chỉ tạo deal cho loại phòng đang kinh doanh của homestay đã duyệt." });
        var now = DateTime.UtcNow;
        var zone = await Zone(roomType.HomestayId);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(now, zone));
        var saleEndsAt = request.SaleEndsAt?.ToUniversalTime() ?? DealRules.DefaultSaleEndUtc(request.StartDate, zone, now);
        if (DealRules.Validate(request.StartDate, request.EndDate, request.DiscountPercent, request.RoomsLimit, saleEndsAt, today, now, zone) is { } error)
            return BadRequest(new { message = error });
        if (await db.RoomDeals.AnyAsync(x => x.RoomTypeId == request.RoomTypeId && x.Status == RoomDealStatus.Active && x.SaleEndsAt > now
                && x.StartDate < request.EndDate && x.EndDate > request.StartDate))
            return Conflict(new { message = "Loại phòng này đã có deal đang chạy trùng ngày. Hãy kết thúc deal cũ trước." });
        var free = (await BookingAvailability.AvailableRoomIds(db, request.RoomTypeId, request.StartDate, request.EndDate, now)).Count;
        if (free < request.RoomsLimit) return Conflict(new { message = $"Chỉ còn {free} phòng trống cho toàn bộ các đêm này." });
        var source = RoomDealSource.Manual;
        if (request.SourceBookingId is { } sourceId)
        {
            if (!await db.Bookings.AnyAsync(x => x.Id == sourceId && x.Homestay.HostId == HostId && x.Status == BookingStatus.NoShow))
                return BadRequest(new { message = "Đơn nguồn không phải đơn không đến của bạn." });
            source = RoomDealSource.NoShow;
        }
        var deal = new RoomDeal { HomestayId = roomType.HomestayId, RoomTypeId = request.RoomTypeId, StartDate = request.StartDate, EndDate = request.EndDate,
            DiscountPercent = request.DiscountPercent, RoomsLimit = request.RoomsLimit, SaleEndsAt = saleEndsAt, AllowVoucher = request.AllowVoucher,
            Source = source, SourceBookingId = request.SourceBookingId, CreatedBy = HostId, CreatedAt = now, UpdatedAt = now };
        db.RoomDeals.Add(deal);
        await db.SaveChangesAsync();
        db.AuditLogs.Add(new AuditLog { ActorId = HostId, ActorRole = "Host", Action = "deal.created", TargetType = "RoomDeal", TargetId = deal.Id.ToString(),
            AfterJson = JsonSerializer.Serialize(new { request.RoomTypeId, request.StartDate, request.EndDate, request.DiscountPercent, request.RoomsLimit, saleEndsAt, source }),
            Ip = HttpContext.Connection.RemoteIpAddress, CreatedAt = now });
        await db.SaveChangesAsync();
        return Ok(new { deal.Id, message = $"Đã mở bán deal giảm {request.DiscountPercent:0.##}% cho {request.RoomsLimit} phòng." });
    }

    // Banner space belongs to the platform, so a host only proposes; an admin approves it in Admin › Banner.
    [HttpPost("{id:long}/promote")]
    public async Task<IActionResult> Promote(long id, PromoteDealRequest request)
    {
        var now = DateTime.UtcNow;
        var deal = await db.RoomDeals.AsNoTracking().Where(x => x.Id == id && x.Homestay.HostId == HostId && x.Status == RoomDealStatus.Active && x.SaleEndsAt > now)
            .Select(x => new { x.Id, x.SaleEndsAt, x.DiscountPercent, HomestayName = x.Homestay.Name, RoomTypeName = x.RoomType.Name,
                Image = x.Homestay.Images.OrderByDescending(i => i.IsThumbnail).ThenBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault() })
            .SingleOrDefaultAsync();
        if (deal is null) return NotFound(new { message = "Không tìm thấy deal đang bán của bạn." });
        if (await db.Banners.AnyAsync(b => b.TargetType == BannerTarget.Deal && b.TargetId == id && (b.Status == BannerStatus.Pending || b.Status == BannerStatus.Active)))
            return Conflict(new { message = "Deal này đã được đề xuất hoặc đang hiển thị trên banner." });
        if (!Homestays.Services.ImageUpload.IsAllowedUrl(deal.Image)) return BadRequest(new { message = "Homestay cần có ảnh bìa hợp lệ để lên banner." });
        var title = string.IsNullOrWhiteSpace(request.Title) ? $"{deal.HomestayName} giảm {deal.DiscountPercent:0.##}% tối nay" : request.Title.Trim();
        var subtitle = string.IsNullOrWhiteSpace(request.Subtitle) ? $"{deal.RoomTypeName} · số lượng có hạn" : request.Subtitle.Trim();
        if (title.Length is < 3 or > 80 || subtitle.Length > 160) return BadRequest(new { message = "Tiêu đề 3–80 ký tự, mô tả tối đa 160 ký tự." });
        db.Banners.Add(new Banner { Title = title, Subtitle = subtitle, ImageUrl = deal.Image!, Placement = BannerPlacement.HomeHero, TargetType = BannerTarget.Deal,
            TargetId = id, StartsAt = now, EndsAt = deal.SaleEndsAt, Priority = 50, Status = BannerStatus.Pending, RequestedBy = HostId, CreatedAt = now, UpdatedAt = now });
        await notifications.NotifyStaff(NotificationTemplates.StaffBannerProposed(title));
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã gửi đề xuất lên banner trang chủ. Quản trị viên sẽ duyệt sớm." });
    }

    [HttpPost("{id:long}/end")]
    public async Task<IActionResult> End(long id)
    {
        var deal = await db.RoomDeals.SingleOrDefaultAsync(x => x.Id == id && x.Homestay.HostId == HostId);
        if (deal is null) return NotFound(new { message = "Không tìm thấy deal." });
        deal.Status = RoomDealStatus.Ended; deal.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã kết thúc deal. Các đơn đã đặt vẫn giữ giá deal." });
    }

    private async Task<TimeZoneInfo> Zone(long homestayId) =>
        NoShowRules.Zone(await db.Homestays.Where(h => h.Id == homestayId).Select(h => h.TimeZoneId).SingleAsync());
}

[ApiController, Route("api/deals")]
public sealed class DealsController(AppDbContext db, DealService deals) : ControllerBase
{
    // Live last-minute deals for the home page "săn phòng giá rẻ" section and the homestay page.
    [AllowAnonymous, HttpGet]
    public async Task<IActionResult> Active([FromQuery] long? homestayId, [FromQuery] string? province, [FromQuery] int limit = 12)
    {
        var now = DateTime.UtcNow; var today = BookingRules.Today;
        var query = db.RoomDeals.AsNoTracking().Where(x => x.Status == RoomDealStatus.Active && x.SaleEndsAt > now && x.EndDate > today
            && x.Homestay.Status == "Approved" && x.RoomType.Status == "Active");
        if (homestayId.HasValue) query = query.Where(x => x.HomestayId == homestayId);
        if (!string.IsNullOrWhiteSpace(province)) query = query.Where(x => x.Homestay.Province == province.Trim());
        var rows = await query.OrderBy(x => x.SaleEndsAt).Take(Math.Clamp(limit, 1, 30) * 2)
            .Select(x => new { Deal = x, x.Homestay.Name, x.Homestay.Province, x.Homestay.District, RoomTypeName = x.RoomType.Name, x.RoomType.BasePrice,
                Image = x.Homestay.Images.OrderByDescending(i => i.IsThumbnail).ThenBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault() })
            .ToListAsync();
        var items = new List<object>();
        foreach (var r in rows)
        {
            var remaining = r.Deal.RoomsLimit - await deals.SoldRooms(r.Deal.Id, now);
            if (remaining <= 0) continue;
            items.Add(new { r.Deal.Id, r.Deal.HomestayId, homestayName = r.Name, r.Province, r.District, image = r.Image, r.Deal.RoomTypeId,
                roomTypeName = r.RoomTypeName, basePrice = r.BasePrice, estimatedPrice = DealRules.EstimatedNightlyPrice(r.BasePrice, r.Deal.DiscountPercent),
                r.Deal.DiscountPercent, r.Deal.StartDate, r.Deal.EndDate, r.Deal.SaleEndsAt, remaining, r.Deal.AllowVoucher });
            if (items.Count >= Math.Clamp(limit, 1, 30)) break;
        }
        return Ok(new { items });
    }
}
