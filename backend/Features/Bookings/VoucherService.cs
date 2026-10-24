using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record VoucherQuote(long Id, string Code, string Name, decimal DiscountAmount, string FundedBy);

public sealed class VoucherService(AppDbContext db)
{
    // A usage only consumes the voucher while its booking is alive or was lost through the guest's own
    // choice. Abandoned holds (Expired/PaymentFailed) and host cancellations give the use back, so a
    // limited voucher cannot be exhausted by creating unpaid holds.
    public IQueryable<VoucherUsage> CountedUsages(DateTime now) =>
        db.VoucherUsages.Where(u => db.Bookings.Any(b => b.Id == u.BookingId
            && (BookingRules.ReservedStatuses.Contains(b.Status)
                || b.Status == BookingStatus.CheckedOut
                || b.Status == BookingStatus.NoShow
                || (b.Status == BookingStatus.Hold && b.HoldExpiresAt > now)
                || (b.Status == BookingStatus.Cancelled && db.Cancellations.Any(c => c.BookingId == b.Id && c.CancelledBy == b.CustomerId)))));

    public async Task<(VoucherQuote? Quote, string? Error)> Validate(string? code, long homestayId, long? customerId,
        decimal eligibleAmount, DateTime now, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(code)) return (null, null);
        var normalized = code.Trim().ToUpperInvariant();
        var voucher = await db.Vouchers.AsNoTracking().SingleOrDefaultAsync(x => x.Code == normalized, cancellationToken);
        if (voucher is null) return (null, "Mã voucher không tồn tại.");
        if (voucher.Status != "Active") return (null, "Voucher đang tạm ngưng.");
        if (now < voucher.ValidFrom || now > voucher.ValidUntil) return (null, "Voucher chưa đến thời gian áp dụng hoặc đã hết hạn.");
        if (voucher.HomestayId.HasValue && voucher.HomestayId != homestayId) return (null, "Voucher không áp dụng cho homestay này.");
        if (eligibleAmount < voucher.MinimumBookingAmount) return (null, $"Đơn phòng phải đạt tối thiểu {voucher.MinimumBookingAmount:N0}đ.");
        if (await LimitError(voucher, customerId, now, null, cancellationToken) is { } limitError) return (null, limitError);
        var discount = voucher.DiscountType == "Percentage"
            ? decimal.Round(eligibleAmount * voucher.DiscountValue / 100m, 0, MidpointRounding.AwayFromZero)
            : voucher.DiscountValue;
        if (voucher.MaximumDiscount.HasValue) discount = Math.Min(discount, voucher.MaximumDiscount.Value);
        discount = Math.Clamp(discount, 0, eligibleAmount);
        return (new(voucher.Id, voucher.Code, voucher.Name, discount, voucher.FundedBy), null);
    }

    // Retrying payment revives a booking whose voucher use was released, so the limits must be re-checked
    // (another guest may have taken the last use meanwhile). Callers hold the voucher lock.
    public async Task<string?> RevalidateForRetry(long bookingId, long customerId, DateTime now, CancellationToken cancellationToken = default)
    {
        var usage = await db.VoucherUsages.AsNoTracking().SingleOrDefaultAsync(x => x.BookingId == bookingId, cancellationToken);
        if (usage is null) return null;
        var voucher = await db.Vouchers.AsNoTracking().SingleAsync(x => x.Id == usage.VoucherId, cancellationToken);
        var error = await LimitError(voucher, customerId, now, bookingId, cancellationToken);
        return error is null ? null : $"Voucher {usage.CodeUsed} đã hết lượt trong lúc chờ thanh toán. Vui lòng đặt lại để nhận giá mới.";
    }

    public async Task<long?> VoucherIdForBooking(long bookingId, CancellationToken cancellationToken = default) =>
        await db.VoucherUsages.Where(x => x.BookingId == bookingId).Select(x => (long?)x.VoucherId).SingleOrDefaultAsync(cancellationToken);

    private async Task<string?> LimitError(Voucher voucher, long? customerId, DateTime now, long? excludingBookingId, CancellationToken cancellationToken)
    {
        var usages = CountedUsages(now).Where(x => x.VoucherId == voucher.Id && (!excludingBookingId.HasValue || x.BookingId != excludingBookingId));
        if (voucher.UsageLimit.HasValue && await usages.CountAsync(cancellationToken) >= voucher.UsageLimit)
            return "Voucher đã hết lượt sử dụng.";
        if (customerId.HasValue && await usages.CountAsync(x => x.CustomerId == customerId, cancellationToken) >= voucher.UsageLimitPerCustomer)
            return "Bạn đã sử dụng hết số lượt của voucher này.";
        return null;
    }
}
