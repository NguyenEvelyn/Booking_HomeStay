using System.Security.Claims;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HomestayAuth.Api.Features.Homestays.Controllers;

[ApiController]
[Route("api/host/homestays")]
[Authorize(Roles = "Host")]
public sealed class HostHomestaysController(IHomestayQueryService service, AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetMine()
    {
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        return Ok(new { items = await service.GetForHostAsync(hostId) });
    }

    [HttpGet("overview")]
    public async Task<IActionResult> Overview()
    {
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var homestayIds = db.Homestays.Where(h => h.HostId == hostId).Select(h => h.Id);
        return Ok(new {
            homestays = await homestayIds.CountAsync(),
            pendingHomestays = await db.Homestays.CountAsync(h => h.HostId == hostId && h.Status == "Pending"),
            bookings = await db.Bookings.CountAsync(b => homestayIds.Contains(b.HomestayId)),
            confirmedBookings = await db.Bookings.CountAsync(b => homestayIds.Contains(b.HomestayId) && b.Status == "Confirmed"),
            revenue = await db.Payments.Where(p => homestayIds.Contains(p.Booking.HomestayId) && p.Status == "Success" && p.TransactionType == "Payment").SumAsync(p => (decimal?)p.Amount) ?? 0,
            averageRating = await db.Reviews.Where(r => homestayIds.Contains(r.HomestayId) && r.Status == "Visible").AverageAsync(r => (double?)r.Rating) ?? 0
        });
    }

    [HttpGet("bookings")]
    public async Task<IActionResult> Bookings()
    {
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var items = await db.Bookings.AsNoTracking().Where(b => db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == hostId))
            .OrderByDescending(b => b.CreatedAt).Select(b => new { b.Id, b.BookingCode, HomestayName = db.Homestays.Where(h => h.Id == b.HomestayId).Select(h => h.Name).First(), CustomerName = db.Users.Where(u => u.Id == b.CustomerId).Select(u => u.FullName).First(), b.CheckInDate, b.CheckOutDate, b.AdultCount, b.ChildCount, b.TotalAmount, b.Status }).ToListAsync();
        return Ok(new { items });
    }

    [HttpPost("{id:long}/submit")]
    public async Task<IActionResult> Submit(long id)
    {
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var item = await db.Homestays.SingleOrDefaultAsync(h => h.Id == id && h.HostId == hostId);
        if (item is null) return NotFound(new { message = "Không tìm thấy homestay." });
        if (item.Status is not ("Draft" or "Rejected")) return BadRequest(new { message = "Homestay không ở trạng thái có thể gửi duyệt." });
        if (!await db.RoomTypes.AnyAsync(r => r.HomestayId == id)) return BadRequest(new { message = "Cần có ít nhất một hạng phòng trước khi gửi duyệt." });
        item.Status = "Pending"; item.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync();
        return Ok(new { message = "Đã gửi homestay chờ Admin duyệt." });
    }
}
