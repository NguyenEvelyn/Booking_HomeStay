using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record DealQuote(long Id, decimal DiscountPercent, DateTime SaleEndsAt, int Remaining, bool AllowVoucher);

public sealed class DealService(AppDbContext db)
{
    // Rooms sold under a deal: live or completed bookings only. Abandoned holds, cancellations and
    // no-shows give the room back to the deal so it can be sold again.
    public IQueryable<Booking> SoldBookings(long dealId, DateTime now) =>
        db.Bookings.Where(b => b.RoomDealId == dealId
            && (BookingRules.ReservedStatuses.Contains(b.Status) || b.Status == BookingStatus.CheckedOut
                || (b.Status == BookingStatus.Hold && b.HoldExpiresAt > now)));

    public async Task<int> SoldRooms(long dealId, DateTime now, long? excludingBookingId = null, CancellationToken cancellationToken = default) =>
        await SoldBookings(dealId, now).Where(b => !excludingBookingId.HasValue || b.Id != excludingBookingId)
            .SelectMany(b => b.Details).SumAsync(d => (int?)d.Quantity, cancellationToken) ?? 0;

    /// <summary>The active deal covering every night of the stay, with its remaining rooms, if any.</summary>
    public async Task<DealQuote?> Find(long roomTypeId, DateOnly checkIn, DateOnly checkOut, DateTime now, long? excludingBookingId = null,
        CancellationToken cancellationToken = default)
    {
        var today = BookingRules.Today;
        var candidates = await db.RoomDeals.AsNoTracking()
            .Where(x => x.RoomTypeId == roomTypeId && x.Status == RoomDealStatus.Active && x.SaleEndsAt > now
                && x.StartDate <= checkIn && x.EndDate >= checkOut)
            .ToListAsync(cancellationToken);
        var deal = candidates.Where(x => DealRules.Covers(x, checkIn, checkOut, today, now)).OrderByDescending(x => x.DiscountPercent).FirstOrDefault();
        if (deal is null) return null;
        var remaining = deal.RoomsLimit - await SoldRooms(deal.Id, now, excludingBookingId, cancellationToken);
        return new DealQuote(deal.Id, deal.DiscountPercent, deal.SaleEndsAt, Math.Max(0, remaining), deal.AllowVoucher);
    }
}
