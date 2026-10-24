using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record NoShowContext(NoShowPolicy Policy, TimeZoneInfo Zone, TimeOnly CheckInTime, DateTime DeadlineUtc,
    decimal PaidAmount, decimal Retained, decimal Refund);

public sealed class NoShowService(AppDbContext db)
{
    // Statuses in which the guest is expected to arrive and the no-show flow applies.
    public static bool AwaitingArrival(string status) => status == BookingStatus.Confirmed;

    public async Task<NoShowContext> Context(Booking booking, CancellationToken cancellationToken = default)
    {
        var homestay = await db.Homestays.AsNoTracking().Where(h => h.Id == booking.HomestayId)
            .Select(h => new { h.TimeZoneId, h.CheckInTime }).SingleAsync(cancellationToken);
        var document = PolicyService.ParseSnapshot(booking.PolicySnapshotJson).Document ?? OperationalPolicyDocument.SunriseGardenDefault();
        var policy = document.NoShow ?? new NoShowPolicy();
        // The homestay check-in time is the one shown to the guest on the booking (GetDetail.CheckInTime).
        var checkInTime = homestay.CheckInTime;
        var zone = NoShowRules.Zone(homestay.TimeZoneId);
        var deadline = NoShowRules.DeadlineUtc(booking.CheckInDate, checkInTime, zone, policy, booking.ExpectedArrivalAt);
        var paid = await PaidAmount(booking.Id, cancellationToken);
        var nights = Math.Max(1, booking.CheckOutDate.DayNumber - booking.CheckInDate.DayNumber);
        var (retained, refund) = NoShowRules.Settlement(paid, booking.DepositAmount, booking.TotalAmount, nights, policy);
        return new NoShowContext(policy, zone, checkInTime, deadline, paid, retained, refund);
    }

    // What the guest has paid and not yet had refunded or queued for refund.
    public async Task<decimal> PaidAmount(long bookingId, CancellationToken cancellationToken = default)
    {
        var payments = db.Payments.Where(p => p.BookingId == bookingId);
        var paid = await payments.Where(p => p.TransactionType != "Refund" && p.Status == "Success").SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0;
        var refunded = await payments.Where(p => p.TransactionType == "Refund" && p.Status != "Failed").SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0;
        return Math.Max(0, paid - refunded);
    }

    public static string? CannotMarkReason(Booking booking, NoShowContext context, DateTime nowUtc) =>
        !AwaitingArrival(booking.Status) ? "Chỉ đánh dấu không đến cho đơn đã xác nhận và khách chưa nhận phòng."
        : nowUtc < context.DeadlineUtc ? $"Chưa hết thời gian chờ khách. Có thể xác nhận không đến từ {TimeZoneInfo.ConvertTimeFromUtc(context.DeadlineUtc, context.Zone):HH:mm dd/MM/yyyy}."
        : null;
}
