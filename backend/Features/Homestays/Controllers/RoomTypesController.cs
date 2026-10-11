using HomestayAuth.Api.Features.Bookings;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Homestays.Controllers;

[ApiController]
[Route("api/room-types")]
public sealed class RoomTypesController(IHomestayQueryService service, AppDbContext db) : ControllerBase
{
    [HttpGet("{roomTypeId:long}")]
    public async Task<IActionResult> GetDetail(long roomTypeId)
    {
        var result = await service.GetActiveRoomTypeDetailAsync(roomTypeId);
        return result is null ? NotFound(new { message = "Không tìm thấy loại phòng." }) : Ok(result);
    }

    [HttpGet("{roomTypeId:long}/calendar")]
    public async Task<IActionResult> GetCalendar(long roomTypeId, [FromQuery] int months = 6)
    {
        months = Math.Clamp(months, 1, 12);
        var roomTypeExists = await db.RoomTypes.AsNoTracking()
            .AnyAsync(x => x.Id == roomTypeId && x.Status == "Active" && x.Homestay.Status == "Approved");
        if (!roomTypeExists) return NotFound(new { message = "Không tìm thấy loại phòng." });

        var totalRooms = await db.Rooms.AsNoTracking()
            .CountAsync(x => x.RoomTypeId == roomTypeId && BookingRules.InventoryStatuses.Contains(x.Status));
        if (totalRooms == 0)
            totalRooms = await db.Rooms.AsNoTracking().CountAsync(x => x.RoomTypeId == roomTypeId);

        var today = BookingRules.Today;
        var endDate = today.AddMonths(months);
        var now = DateTime.UtcNow;
        var bookings = await db.BookingDetails.AsNoTracking()
            .Where(x => x.RoomTypeId == roomTypeId && x.Booking.CheckInDate < endDate && x.Booking.CheckOutDate > today
                && (BookingRules.ReservedStatuses.Contains(x.Booking.Status)
                    || (x.Booking.Status == BookingStatus.Hold && x.Booking.HoldExpiresAt > now)))
            .Select(x => new { x.Booking.CheckInDate, x.Booking.CheckOutDate, Quantity = x.Quantity > 0 ? x.Quantity : 1 })
            .ToListAsync();

        var bookedDates = new List<string>();
        var dailyStatus = new Dictionary<string, object>();
        for (var date = today; date <= endDate; date = date.AddDays(1))
        {
            var booked = bookings.Where(x => x.CheckInDate <= date && x.CheckOutDate > date).Sum(x => x.Quantity);
            var available = Math.Max(0, totalRooms - booked);
            if (available == 0) bookedDates.Add(date.ToString("yyyy-MM-dd"));
            dailyStatus[date.ToString("yyyy-MM-dd")] = new { status = available == 0 ? "booked" : "available", availableRooms = available, totalRooms };
        }

        return Ok(new { roomTypeId, totalRooms, bookedDates, dailyStatus });
    }
}

