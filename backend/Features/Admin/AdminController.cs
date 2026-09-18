using System.Security.Claims;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Admin;

public sealed record AdminDecisionRequest(string? Reason);

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public sealed class AdminController(AppDbContext db) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<IActionResult> Overview() => Ok(new {
        users = await db.Users.CountAsync(), hosts = await db.Users.CountAsync(u => u.Role == "Host"),
        homestays = await db.Homestays.CountAsync(), pendingHomestays = await db.Homestays.CountAsync(h => h.Status == "Pending"),
        bookings = await db.Bookings.CountAsync(), revenue = await db.Payments.Where(p => p.Status == "Success" && p.TransactionType == "Payment").SumAsync(p => (decimal?)p.Amount) ?? 0
    });

    [HttpGet("homestays")]
    public async Task<IActionResult> Homestays() => Ok(new { items = await db.Homestays.AsNoTracking().OrderBy(h => h.Status == "Pending" ? 0 : 1).ThenByDescending(h => h.UpdatedAt)
        .Select(h => new { h.Id, h.Name, h.AddressLine, h.District, h.Province, h.Status, h.RejectionReason, h.ReviewedAt, HostName = db.Users.Where(u => u.Id == h.HostId).Select(u => u.FullName).First(), RoomTypeCount = h.RoomTypes.Count(), h.UpdatedAt }).ToListAsync() });

    [HttpGet("homestays/{id:long}")]
    public async Task<IActionResult> HomestayDetail(long id)
    {
        var item = await db.Homestays.AsNoTracking().Where(h => h.Id == id).Select(h => new
        {
            h.Id, h.Name, h.Description, h.AddressLine, h.Ward, h.District, h.Province, h.Status, h.RejectionReason,
            HostName = db.Users.Where(u => u.Id == h.HostId).Select(u => u.FullName).First(),
            Amenities = h.HomestayAmenities.Select(x => x.Amenity.Name).ToList(),
            Images = h.Images.OrderByDescending(x => x.IsThumbnail).ThenBy(x => x.SortOrder).Select(x => new { x.ImageUrl, x.Caption, x.IsThumbnail }).ToList(),
            RoomTypes = h.RoomTypes.Select(x => new { x.Id, x.Name, x.Description, x.BasePrice, x.MaxAdults, x.MaxChildren, x.Status, RoomCount = x.Rooms.Count() }).ToList()
        }).SingleOrDefaultAsync();
        return item is null ? NotFound(new { message = "Không tìm thấy homestay." }) : Ok(item);
    }

    [HttpPatch("homestays/{id:long}/{decision}")]
    public async Task<IActionResult> DecideHomestay(long id, string decision, AdminDecisionRequest request)
    {
        var item = await db.Homestays.SingleOrDefaultAsync(h => h.Id == id);
        if (item is null) return NotFound(new { message = "Không tìm thấy homestay." });
        if (decision.Equals("approve", StringComparison.OrdinalIgnoreCase) && (!await db.HomestayImages.AnyAsync(x => x.HomestayId == id) || !await db.Rooms.AnyAsync(x => x.RoomType.HomestayId == id)))
            return BadRequest(new { message = "Không thể duyệt Homestay chưa có ảnh và phòng kinh doanh." });
        if ((decision.Equals("approve", StringComparison.OrdinalIgnoreCase) || decision.Equals("reject", StringComparison.OrdinalIgnoreCase)) && item.Status != "Pending")
            return BadRequest(new { message = "Admin chỉ duyệt hoặc từ chối Homestay mới đang chờ duyệt." });
        if (decision.Equals("suspend", StringComparison.OrdinalIgnoreCase) && item.Status != "Approved")
            return BadRequest(new { message = "Chỉ có thể tạm ngưng Homestay đang hoạt động." });
        var status = decision.ToLowerInvariant() switch { "approve" => "Approved", "reject" => "Rejected", "suspend" => "Suspended", _ => null };
        if (status is null) return BadRequest(new { message = "Thao tác không hợp lệ." });
        var reason = request.Reason?.Trim();
        if (status == "Rejected" && string.IsNullOrWhiteSpace(reason)) return BadRequest(new { message = "Vui lòng nhập lý do từ chối để Host chỉnh sửa." });
        if ((reason?.Length ?? 0) > 500) return BadRequest(new { message = "Lý do tối đa 500 ký tự." });
        item.Status = status;
        item.RejectionReason = status == "Rejected" ? reason : null;
        item.ReviewedBy = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        item.ReviewedAt = DateTime.UtcNow;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = status == "Approved" ? "Đã duyệt homestay." : status == "Rejected" ? "Đã từ chối homestay." : "Đã tạm ngưng homestay." });
    }

    [HttpGet("users")]
    public async Task<IActionResult> Users() => Ok(new { items = await db.Users.AsNoTracking().OrderByDescending(u => u.CreatedAt).Select(u => new { u.Id, u.FullName, u.Email, u.Role, u.Status, u.CreatedAt }).ToListAsync() });

    [HttpPatch("users/{id:long}/status")]
    public async Task<IActionResult> SetUserStatus(long id, AdminDecisionRequest request)
    {
        var adminId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (id == adminId) return BadRequest(new { message = "Bạn không thể khóa tài khoản đang đăng nhập." });
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound(new { message = "Không tìm thấy tài khoản." });
        user.Status = user.Status == "Active" ? "Locked" : "Active"; user.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync();
        return Ok(new { message = user.Status == "Active" ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản." });
    }
}
