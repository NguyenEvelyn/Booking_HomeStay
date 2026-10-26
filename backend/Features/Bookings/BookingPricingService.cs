using HomestayAuth.Api.Domain.Entities;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record BookingPricingResult(
    int Nights,
    decimal BaseRoomAmount,
    decimal SeasonalSurchargeAmount,
    decimal RoomAmountBeforeDiscount,
    string? PromotionCode,
    decimal PromotionPercent,
    decimal DiscountAmount,
    decimal RoomAmount,
    int ExtraAdults,
    decimal ExtraAdultFee,
    decimal ChildSurcharge,
    decimal TotalAmount,
    decimal DepositPercent,
    decimal DepositAmount,
    decimal AmountDueNow,
    string PaymentOption,
    bool HasHolidayDepositRule,
    decimal MinNightlyPrice,
    decimal MaxNightlyPrice,
    decimal NightlyRoomTotal,
    IReadOnlyList<NightlyPriceBreakdown> NightsBreakdown,
    IReadOnlyList<ChildPriceBreakdown> ChildrenBreakdown,
    OccupancyEvaluation Occupancy);

public sealed record NightlyPriceBreakdown(
    DateOnly Date,
    decimal BasePrice,
    decimal DefaultPrice,
    decimal Price,
    bool IsSpecial,
    bool IsHigherThanDefault,
    string? Label,
    string? SurchargeCode,
    decimal SurchargePercent,
    decimal FinalPrice);
// One line per children group: "Tall" (from 1.2 m, beyond capacity, fixed fee per night) or "Small" (under 1.2 m, free).
public sealed record ChildPriceBreakdown(string Group, int Count, decimal FeePerNight, decimal Amount);

public sealed class BookingPricingService
{
    public BookingPricingResult Calculate(
        RoomType roomType,
        DateOnly checkIn,
        DateOnly checkOut,
        int adults,
        int children,
        int quantity,
        IReadOnlyList<int>? childAges,
        string? paymentOption,
        IReadOnlyList<RoomPricePeriod> pricePeriods,
        BookingPolicySnapshot policy,
        DateOnly today,
        int? dayUseHours = null,
        decimal? dealPercent = null,
        Party? party = null)
    {
        var document = policy.Document ?? OperationalPolicyDocument.SunriseGardenDefault();
        var isDayUse = checkOut == checkIn && dayUseHours is > 0 && document.DayUse.Enabled;
        var nights = isDayUse ? 0 : checkOut.DayNumber - checkIn.DayNumber;
        var pricingEnd = isDayUse ? checkIn.AddDays(1) : checkOut;
        var nightLines = new List<NightlyPriceBreakdown>(nights);
        var baseRoomAmount = 0m;
        var seasonalSurcharge = 0m;
        var holidayDeposit = false;

        for (var date = checkIn; date < pricingEnd; date = date.AddDays(1))
        {
            var night = Night(roomType, date, pricePeriods, document);
            baseRoomAmount += night.BasePrice * quantity;
            seasonalSurcharge += (night.FinalPrice - night.BasePrice) * quantity;
            holidayDeposit |= night.RequiresHolidayDeposit;
            nightLines.Add(night.Line);
        }

        var dayUsePercent = isDayUse
            ? dayUseHours <= 3 ? document.DayUse.UpToThreeHoursPercent : dayUseHours <= 6 ? document.DayUse.UpToSixHoursPercent : document.DayUse.OverSixHoursPercent
            : 100m;
        var roomBeforeDiscount = Round((baseRoomAmount + seasonalSurcharge) * dayUsePercent / 100m);
        // A last-minute deal replaces the automatic promotions instead of stacking with them.
        var promotion = isDayUse ? (Code: (string?)null, Percent: 0m)
            : dealPercent is > 0 ? (Code: (string?)DealRules.PromotionCode, Percent: dealPercent.Value)
            : BestPromotion(document.Promotions, today, checkIn, nights);
        var discount = Round(roomBeforeDiscount * promotion.Percent / 100m);
        var roomAmount = roomBeforeDiscount - discount;

        // Occupancy: adults and children from 1.2 m fill the standard capacity; children from 1.2 m beyond it pay a
        // fixed fee per night, children under 1.2 m are free; extra adults only when the host enabled it.
        var occupancyParty = party ?? OccupancyRules.FromCounts(adults, children, null, null, childAges, document.Guests.AdultAge);
        var occupancy = OccupancyRules.Evaluate(occupancyParty, quantity, roomType.BaseCapacity, roomType.MaxCapacity, roomType.ExtraGuestAllowed, roomType.MaxExtraChildren);
        var chargeUnits = isDayUse ? 1 : nights;
        var extraAdults = occupancy.ExtraAdults;
        var extraAdultFee = extraAdults * roomType.ExtraGuestFee * chargeUnits;
        var childSurcharge = occupancy.ExtraTallChildren * roomType.ExtraChildFee * chargeUnits;
        var childBreakdown = new List<ChildPriceBreakdown>();
        if (occupancy.ExtraTallChildren > 0) childBreakdown.Add(new("Tall", occupancy.ExtraTallChildren, roomType.ExtraChildFee, childSurcharge));
        if (occupancyParty.SmallChildren > 0) childBreakdown.Add(new("Small", occupancyParty.SmallChildren, 0, 0));

        var total = roomAmount + extraAdultFee + childSurcharge;
        var standardDeposit = isDayUse ? document.DayUse.DepositPercent : Math.Max(roomType.DepositPercent * 100m, document.Payment.StandardDepositPercent);
        var depositPercent = standardDeposit;
        if (roomType.Name.Contains("villa", StringComparison.OrdinalIgnoreCase))
            depositPercent = Math.Max(depositPercent, document.Payment.VillaDepositPercent);
        if (holidayDeposit)
            depositPercent = Math.Max(depositPercent, document.Payment.HolidayDepositPercent);
        depositPercent = Math.Clamp(depositPercent, 0, 100);
        var deposit = Round(total * depositPercent / 100m);
        var normalizedPaymentOption = string.Equals(paymentOption, "Full", StringComparison.OrdinalIgnoreCase) ? "Full" : "Deposit";
        var dueNow = normalizedPaymentOption == "Full" ? total : deposit;

        var minNightlyPrice = nightLines.Count > 0 ? nightLines.Min(x => x.Price) : roomType.BasePrice;
        var maxNightlyPrice = nightLines.Count > 0 ? nightLines.Max(x => x.Price) : roomType.BasePrice;
        var nightlyRoomTotal = nightLines.Sum(x => x.Price) * quantity;

        return new(nights, baseRoomAmount, seasonalSurcharge, roomBeforeDiscount, promotion.Code, promotion.Percent,
            discount, roomAmount, extraAdults, extraAdultFee, childSurcharge, total, depositPercent, deposit, dueNow,
            normalizedPaymentOption, holidayDeposit, minNightlyPrice, maxNightlyPrice, nightlyRoomTotal, nightLines, childBreakdown, occupancy);
    }

    public static string? ValidateChildAges(int childCount, IReadOnlyList<int>? ages)
    {
        if (ages is null || ages.Count == 0) return null;
        if (ages.Count != childCount) return "Số tuổi trẻ em phải khớp với số trẻ em đã khai báo.";
        return ages.Any(x => x is < 0 or > 17) ? "Tuổi trẻ em phải nằm trong khoảng 0–17." : null;
    }

    // Price of one night for one room before promotions: the latest price period covering the date (else the
    // room type's base price) plus the highest seasonal surcharge. Shared by the quote and the room calendar.
    public static (decimal BasePrice, decimal FinalPrice, bool RequiresHolidayDeposit, NightlyPriceBreakdown Line) Night(
        RoomType roomType, DateOnly date, IReadOnlyList<RoomPricePeriod> pricePeriods, OperationalPolicyDocument document)
    {
        var pricePeriod = pricePeriods
            .Where(x => x.StartDate <= date && x.EndDate >= date)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefault();
        var basePrice = pricePeriod?.PricePerNight ?? roomType.BasePrice;
        var surcharge = document.SeasonalSurcharges
            .Where(x => Applies(x, date))
            .OrderByDescending(x => x.Percent)
            .FirstOrDefault();
        var surchargePercent = surcharge?.Percent ?? 0;
        var finalPrice = basePrice + Round(basePrice * surchargePercent / 100m);
        var isSpecial = finalPrice != roomType.BasePrice;
        var specialName = pricePeriod?.Name ?? surcharge?.Name;
        var label = isSpecial
            ? string.IsNullOrWhiteSpace(specialName) ? "Giá đặc biệt"
                : specialName.StartsWith("Giá ", StringComparison.OrdinalIgnoreCase) ? specialName : $"Giá {specialName.ToLowerInvariant()}"
            : null;
        return (basePrice, finalPrice, surcharge?.RequiresHolidayDeposit == true,
            new(date, basePrice, roomType.BasePrice, finalPrice, isSpecial, finalPrice > roomType.BasePrice, label,
                surcharge?.Code, surchargePercent, finalPrice));
    }

    private static bool Applies(SeasonalSurchargeRule rule, DateOnly date)
    {
        var inDateRange = rule.StartDate.HasValue && rule.EndDate.HasValue && date >= rule.StartDate && date <= rule.EndDate;
        var inWeekDays = rule.DaysOfWeek.Contains(date.DayOfWeek);
        return inDateRange || inWeekDays;
    }

    private static (string? Code, decimal Percent) BestPromotion(PromotionPolicy policy, DateOnly today, DateOnly checkIn, int nights)
    {
        var offers = new List<(string Code, decimal Percent)>();
        if (checkIn.DayNumber - today.DayNumber >= policy.EarlyBirdMinimumDays)
            offers.Add(("EarlyBird", policy.EarlyBirdPercent));
        if (nights >= policy.LongStayMinimumNights)
            offers.Add(("LongStay", policy.LongStayPercent));
        if (nights >= policy.ExtendedStayMinimumNights)
            offers.Add(("ExtendedStay", policy.ExtendedStayPercent));
        return offers.OrderByDescending(x => x.Percent).Select(x => ((string?)x.Code, x.Percent)).FirstOrDefault();
    }

    private static decimal Round(decimal value) => decimal.Round(value, 0, MidpointRounding.AwayFromZero);
}
