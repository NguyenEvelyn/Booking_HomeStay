using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public static class BookingAvailability
{
    public static IQueryable<BookingDetail> BlockingDetails(AppDbContext db, DateOnly checkIn, DateOnly checkOut, DateTime now)
    {
        return db.BookingDetails.Where(d => d.Booking.CheckInDate < checkOut && d.Booking.CheckOutDate > checkIn
            && (BookingRules.ReservedStatuses.Contains(d.Booking.Status)
                || (d.Booking.Status == BookingStatus.Hold && d.Booking.HoldExpiresAt > now)));
    }

    // A room stay only occupies a room while its booking does: a failed or expired payment leaves its
    // stay rows "Active", and counting them would block the room for those dates forever.
    public static IQueryable<BookingRoomStay> BlockingStays(AppDbContext db, DateOnly from, DateOnly to, DateTime now) =>
        db.BookingRoomStays.Where(s => s.StartDate < to && s.EndDate > from && s.Status == "Active"
            && (BookingRules.ReservedStatuses.Contains(s.Booking.Status)
                || (s.Booking.Status == BookingStatus.Hold && s.Booking.HoldExpiresAt > now)));

    public static async Task<List<long>> AvailableRoomIds(AppDbContext db, long roomTypeId,
        DateOnly checkIn, DateOnly checkOut, DateTime now, long? excludingBookingId = null)
    {
        var futureCheckIn = checkIn > BookingRules.Today;
        var occupied = BlockingDetails(db, checkIn, checkOut, now)
            .Where(d => d.RoomTypeId == roomTypeId && (!excludingBookingId.HasValue || d.BookingId != excludingBookingId));
        var occupiedStayRooms = BlockingStays(db, checkIn, checkOut, now)
            .Where(s => !excludingBookingId.HasValue || s.BookingId != excludingBookingId).Select(s => s.RoomId);
        var legacyCount = await occupied.Where(d => d.RoomId == null).SumAsync(d => (int?)d.Quantity) ?? 0;
        return await db.Rooms.Where(r => r.RoomTypeId == roomTypeId && (r.Status == "Available" || (futureCheckIn && BookingRules.InventoryStatuses.Contains(r.Status)))
                && !occupiedStayRooms.Contains(r.Id)
                && !occupied.Any(d => d.RoomId == r.Id && !db.BookingRoomStays.Any(s => s.BookingId == d.BookingId)))
            .OrderBy(r => r.RoomNumber).Skip(legacyCount).Select(r => r.Id).ToListAsync();
    }

    // Serialize changes to a booking, including duplicate gateway callbacks and cancellation.
    public static Task LockBooking(AppDbContext db, long bookingId) =>
        AdvisoryLocks.Booking(db, bookingId);
}
