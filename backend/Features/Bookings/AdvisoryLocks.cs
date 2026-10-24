using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

// Transaction-scoped PostgreSQL advisory locks. Each entity type has its own namespace
// (two-key form) so that booking #5, voucher #5 and room type #5 never share a lock.
// Acquire in this order to avoid deadlocks: booking -> room type -> voucher.
public static class AdvisoryLocks
{
    public const int BookingNamespace = 1;
    public const int RoomTypeNamespace = 2;
    public const int VoucherNamespace = 3;
    public const int HomestayPolicyNamespace = 4;

    public static Task Booking(AppDbContext db, long bookingId) => Lock(db, BookingNamespace, bookingId);
    public static Task RoomType(AppDbContext db, long roomTypeId) => Lock(db, RoomTypeNamespace, roomTypeId);
    public static Task Voucher(AppDbContext db, long voucherId) => Lock(db, VoucherNamespace, voucherId);
    public static Task HomestayPolicy(AppDbContext db, long homestayId) => Lock(db, HomestayPolicyNamespace, homestayId);

    private static Task Lock(AppDbContext db, int lockNamespace, long id) =>
        db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock({0}, {1})", lockNamespace, checked((int)id));
}
