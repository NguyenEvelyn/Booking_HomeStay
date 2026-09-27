using HomestayAuth.Api.Domain.Entities;
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
    public async Task<IActionResult> GetCalendar(long roomTypeId, [FromQuery] int months = 3)
    {
        months = Math.Clamp(months, 1, 12);
        var roomType = await db.RoomTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(rt => rt.Id == roomTypeId && rt.Status == "Active");

        if (roomType is null)
            return NotFound(new { message = "Không tìm thấy loại phòng." });

        var totalRooms = await db.Rooms
            .AsNoTracking()
            .CountAsync(r => r.RoomTypeId == roomTypeId && (r.Status == "Available" || BookingRules.InventoryStatuses.Contains(r.Status)));

        if (totalRooms == 0)
        {
            totalRooms = await db.Rooms.AsNoTracking().CountAsync(r => r.RoomTypeId == roomTypeId);
            if (totalRooms == 0) totalRooms = 1;
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var endDate = today.AddDays(months * 31);
        var now = DateTime.UtcNow;

        var activeBookings = await db.BookingDetails
            .AsNoTracking()
            .Where(d => d.RoomTypeId == roomTypeId
                && d.Booking.CheckInDate < endDate
                && d.Booking.CheckOutDate > today
                && (BookingRules.ReservedStatuses.Contains(d.Booking.Status)
                    || (d.Booking.Status == BookingStatus.Hold && d.Booking.HoldExpiresAt > now)))
            .Select(d => new
            {
                d.Booking.CheckInDate,
                d.Booking.CheckOutDate,
                Quantity = d.Quantity > 0 ? d.Quantity : 1
            })
            .ToListAsync();

        var bookedDates = new List<string>();
        var dailyStatus = new Dictionary<string, object>();

        for (var date = today; date <= endDate; date = date.AddDays(1))
        {
            var dateStr = date.ToString("yyyy-MM-dd");
            var bookedCount = activeBookings
                .Where(b => b.CheckInDate <= date && b.CheckOutDate > date)
                .Sum(b => b.Quantity);

            var available = Math.Max(0, totalRooms - bookedCount);
            var isBooked = bookedCount >= totalRooms;

            if (isBooked)
            {
                bookedDates.Add(dateStr);
            }

            dailyStatus[dateStr] = new
            {
                status = isBooked ? "booked" : "available",
                availableRooms = available,
                totalRooms = totalRooms
            };
        }

        return Ok(new
        {
            roomTypeId,
            totalRooms,
            bookedDates,
            dailyStatus
        });
    }
}

