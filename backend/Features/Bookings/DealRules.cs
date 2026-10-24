using HomestayAuth.Api.Domain.Entities;

namespace HomestayAuth.Api.Features.Bookings;

// Pure rules for last-minute deals (no database), shared by the API and the checks project.
public static class DealRules
{
    public const decimal MinimumPercent = 5;
    public const decimal MaximumPercent = 70;
    // Deals are for nights starting today up to this many days ahead, covering at most MaxNights nights.
    public const int MaxDaysAhead = 3;
    public const int MaxNights = 3;
    public const int MaxRooms = 20;
    public const string PromotionCode = "LastMinuteDeal";

    /// <summary>Default end of sale: 22:00 local on the first night, or 23:59 if it is already later than that.</summary>
    public static DateTime DefaultSaleEndUtc(DateOnly startDate, TimeZoneInfo zone, DateTime nowUtc)
    {
        var at22 = NoShowRules.LocalToUtc(startDate, new TimeOnly(22, 0), zone);
        return at22 > nowUtc ? at22 : NoShowRules.LocalToUtc(startDate, new TimeOnly(23, 59), zone);
    }

    public static string? Validate(DateOnly startDate, DateOnly endDate, decimal discountPercent, int roomsLimit, DateTime saleEndsAtUtc,
        DateOnly today, DateTime nowUtc, TimeZoneInfo zone)
    {
        if (discountPercent < MinimumPercent || discountPercent > MaximumPercent)
            return $"Mức giảm phải từ {MinimumPercent:0}% đến {MaximumPercent:0}%.";
        if (startDate < today || startDate.DayNumber - today.DayNumber > MaxDaysAhead)
            return $"Deal phút chót chỉ áp dụng cho đêm bắt đầu từ hôm nay đến {MaxDaysAhead} ngày tới.";
        var nights = endDate.DayNumber - startDate.DayNumber;
        if (nights < 1 || nights > MaxNights) return $"Deal áp dụng từ 1 đến {MaxNights} đêm.";
        if (roomsLimit < 1 || roomsLimit > MaxRooms) return $"Số phòng bán deal phải từ 1 đến {MaxRooms}.";
        if (saleEndsAtUtc <= nowUtc) return "Thời điểm kết thúc bán phải ở tương lai.";
        if (saleEndsAtUtc > NoShowRules.LocalToUtc(startDate, new TimeOnly(23, 59), zone))
            return "Deal phải ngừng bán trước nửa đêm của đêm đầu tiên.";
        return null;
    }

    /// <summary>A deal applies only when every night of the stay is inside the deal and it is still on sale.</summary>
    public static bool Covers(RoomDeal deal, DateOnly checkIn, DateOnly checkOut, DateOnly today, DateTime nowUtc) =>
        deal.Status == RoomDealStatus.Active && nowUtc < deal.SaleEndsAt
        && checkOut > checkIn && checkIn >= today && checkIn >= deal.StartDate && checkOut <= deal.EndDate;

    public static decimal EstimatedNightlyPrice(decimal basePrice, decimal discountPercent) =>
        decimal.Round(basePrice * (100 - discountPercent) / 100m, 0, MidpointRounding.AwayFromZero);

    // Deal bookings are sold as non-refundable: one tier, 0% refund at any distance from check-in.
    public static BookingPolicySnapshot NonRefundable(BookingPolicySnapshot policy) =>
        policy with { CancellationTiers = [new CancellationTierSnapshot(0, null, 0)] };
}
