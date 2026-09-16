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
        .Select(h => new { h.Id, h.Name, h.AddressLine, h.District, h.Province, h.Status, HostName = db.Users.Where(u => u.Id == h.HostId).Select(u => u.FullName).First(), RoomTypeCount = h.RoomTypes.Count(), h.UpdatedAt }).ToListAsync() });

    [HttpPatch("homestays/{id:long}/{action}")]
    public async Task<IActionResult> DecideHomestay(long id, string action, AdminDecisionRequest request)
    {
        var item = await db.Homestays.SingleOrDefaultAsync(h => h.Id == id);
        if (item is null) return NotFound(new { message = "Không tìm thấy homestay." });
        var status = action.ToLowerInvariant() switch { "approve" => "Approved", "reject" => "Rejected", "suspend" => "Suspended", _ => null };
        if (status is null) return BadRequest(new { message = "Thao tác không hợp lệ." });
        item.Status = status; item.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync();
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
