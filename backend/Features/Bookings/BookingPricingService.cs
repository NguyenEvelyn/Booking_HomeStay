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
    IReadOnlyList<NightlyPriceBreakdown> NightsBreakdown,
    IReadOnlyList<ChildPriceBreakdown> ChildrenBreakdown);

public sealed record NightlyPriceBreakdown(DateOnly Date, decimal BasePrice, string? SurchargeCode, decimal SurchargePercent, decimal FinalPrice);
public sealed record ChildPriceBreakdown(int Age, decimal Percent, decimal Amount);

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
        DateOnly today)
    {
        var document = policy.Document ?? OperationalPolicyDocument.SunriseGardenDefault();
        var nights = checkOut.DayNumber - checkIn.DayNumber;
        var nightLines = new List<NightlyPriceBreakdown>(nights);
        var baseRoomAmount = 0m;
        var seasonalSurcharge = 0m;
        var holidayDeposit = false;

        for (var date = checkIn; date < checkOut; date = date.AddDays(1))
        {
            var basePrice = pricePeriods
                .Where(x => x.StartDate <= date && x.EndDate >= date)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => (decimal?)x.PricePerNight)
                .FirstOrDefault() ?? roomType.BasePrice;
            var surcharge = document.SeasonalSurcharges
                .Where(x => Applies(x, date))
                .OrderByDescending(x => x.Percent)
                .FirstOrDefault();
            var surchargePercent = surcharge?.Percent ?? 0;
            var surchargeValue = Round(basePrice * surchargePercent / 100m);
            var finalPrice = basePrice + surchargeValue;
            baseRoomAmount += basePrice * quantity;
            seasonalSurcharge += surchargeValue * quantity;
            holidayDeposit |= surcharge?.RequiresHolidayDeposit == true;
            nightLines.Add(new(date, basePrice, surcharge?.Code, surchargePercent, finalPrice));
        }

        var roomBeforeDiscount = baseRoomAmount + seasonalSurcharge;
        var promotion = BestPromotion(document.Promotions, today, checkIn, nights);
        var discount = Round(roomBeforeDiscount * promotion.Percent / 100m);
        var roomAmount = roomBeforeDiscount - discount;

        var included = roomType.BaseCapacity * quantity;
        var extraAdults = Math.Max(0, adults - included);
        var extraAdultFee = extraAdults * roomType.ExtraGuestFee * nights;
        var childBreakdown = new List<ChildPriceBreakdown>();
        decimal childSurcharge;
        if (childAges is { Count: > 0 })
        {
            childSurcharge = 0;
            var perRoomStayAfterSurcharge = nightLines.Sum(x => x.FinalPrice);
            foreach (var age in childAges)
            {
                var percent = document.Guests.ChildFeeTiers
                    .Where(x => age >= x.MinimumAge && age < x.MaximumAgeExclusive)
                    .OrderByDescending(x => x.MinimumAge)
                    .Select(x => (decimal?)x.Percent)
                    .FirstOrDefault() ?? (age >= document.Guests.AdultAge ? 100m : 0m);
                var amount = Round(perRoomStayAfterSurcharge * percent / 100m);
                childSurcharge += amount;
                childBreakdown.Add(new(age, percent, amount));
            }
        }
        else
        {
            var remainingIncluded = Math.Max(0, included - adults);
            var extraChildren = Math.Max(0, children - remainingIncluded);
            childSurcharge = extraChildren * roomType.ExtraChildFee * nights;
        }

        var total = roomAmount + extraAdultFee + childSurcharge;
        var standardDeposit = Math.Max(roomType.DepositPercent * 100m, document.Payment.StandardDepositPercent);
        var depositPercent = standardDeposit;
        if (roomType.Name.Contains("villa", StringComparison.OrdinalIgnoreCase))
            depositPercent = Math.Max(depositPercent, document.Payment.VillaDepositPercent);
        if (holidayDeposit)
            depositPercent = Math.Max(depositPercent, document.Payment.HolidayDepositPercent);
        depositPercent = Math.Clamp(depositPercent, 0, 100);
        var deposit = Round(total * depositPercent / 100m);
        var normalizedPaymentOption = string.Equals(paymentOption, "Full", StringComparison.OrdinalIgnoreCase) ? "Full" : "Deposit";
        var dueNow = normalizedPaymentOption == "Full" ? total : deposit;

        return new(nights, baseRoomAmount, seasonalSurcharge, roomBeforeDiscount, promotion.Code, promotion.Percent,
            discount, roomAmount, extraAdults, extraAdultFee, childSurcharge, total, depositPercent, deposit, dueNow,
            normalizedPaymentOption, holidayDeposit, nightLines, childBreakdown);
    }

    public static string? ValidateChildAges(int childCount, IReadOnlyList<int>? ages)
    {
        if (ages is null || ages.Count == 0) return null;
        if (ages.Count != childCount) return "Số tuổi trẻ em phải khớp với số trẻ em đã khai báo.";
        return ages.Any(x => x is < 0 or > 17) ? "Tuổi trẻ em phải nằm trong khoảng 0–17." : null;
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
