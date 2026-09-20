using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public static class BookingAvailability
{
    public static IQueryable<BookingDetail> BlockingDetails(AppDbContext db, DateOnly checkIn, DateOnly checkOut, DateTime now)
    {
        var cutoff = now.AddMinutes(-BookingRules.HoldMinutes);
        return db.BookingDetails.Where(d => d.Booking.CheckInDate < checkOut && d.Booking.CheckOutDate > checkIn
            && (BookingRules.ReservedStatuses.Contains(d.Booking.Status)
                || (d.Booking.Status == "PendingPayment" && d.Booking.UpdatedAt > cutoff)));
    }

    public static async Task<List<long>> AvailableRoomIds(AppDbContext db, long roomTypeId,
        DateOnly checkIn, DateOnly checkOut, DateTime now, long? excludingBookingId = null)
    {
        var futureCheckIn = checkIn > BookingRules.Today;
        var occupied = BlockingDetails(db, checkIn, checkOut, now)
            .Where(d => d.RoomTypeId == roomTypeId && (!excludingBookingId.HasValue || d.BookingId != excludingBookingId));
        var legacyCount = await occupied.Where(d => d.RoomId == null).SumAsync(d => (int?)d.Quantity) ?? 0;
        return await db.Rooms.Where(r => r.RoomTypeId == roomTypeId && (r.Status == "Available" || (futureCheckIn && BookingRules.InventoryStatuses.Contains(r.Status)))
                && !occupied.Any(d => d.RoomId == r.Id))
            .OrderBy(r => r.RoomNumber).Skip(legacyCount).Select(r => r.Id).ToListAsync();
    }

    // Serialize changes to a booking, including duplicate gateway callbacks and cancellation.
    public static Task LockBooking(AppDbContext db, long bookingId) =>
        db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock({0})", -bookingId);
}
