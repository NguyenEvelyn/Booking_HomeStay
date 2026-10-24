using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record VoucherQuote(long Id, string Code, string Name, decimal DiscountAmount);

public sealed class VoucherService(AppDbContext db)
{
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
        if (voucher.UsageLimit.HasValue && await db.VoucherUsages.CountAsync(x => x.VoucherId == voucher.Id, cancellationToken) >= voucher.UsageLimit)
            return (null, "Voucher đã hết lượt sử dụng.");
        if (customerId.HasValue && await db.VoucherUsages.CountAsync(x => x.VoucherId == voucher.Id && x.CustomerId == customerId, cancellationToken) >= voucher.UsageLimitPerCustomer)
            return (null, "Bạn đã sử dụng hết số lượt của voucher này.");
        var discount = voucher.DiscountType == "Percentage"
            ? decimal.Round(eligibleAmount * voucher.DiscountValue / 100m, 0, MidpointRounding.AwayFromZero)
            : voucher.DiscountValue;
        if (voucher.MaximumDiscount.HasValue) discount = Math.Min(discount, voucher.MaximumDiscount.Value);
        discount = Math.Clamp(discount, 0, eligibleAmount);
        return (new(voucher.Id, voucher.Code, voucher.Name, discount), null);
    }
}
