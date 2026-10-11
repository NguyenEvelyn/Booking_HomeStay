using HomestayAuth.Api.Features.Bookings;

static void Check(bool condition, string name)
{
    if (!condition) throw new Exception($"Booking rule failed: {name}");
}

var now = new DateTime(2026, 9, 20, 10, 0, 0, DateTimeKind.Utc);
var start = now.AddMinutes(1);
var expired = now.AddMinutes(-1);
var today = DateOnly.FromDateTime(now);

Check(BookingRules.IsActiveHold(BookingStatus.Hold, start, now), "active 15-minute hold");
Check(!BookingRules.IsActiveHold(BookingStatus.Hold, expired, now), "expired hold");
Check(!BookingRules.IsActiveHold("Confirmed", start, now), "confirmed booking is not a hold");
Check(BookingRules.CanConfirm(BookingStatus.Hold, start, start, now), "current payment may confirm");
Check(!BookingRules.CanConfirm(BookingStatus.Hold, start, start.AddMinutes(1), now), "payment created after hold expiry cannot confirm");
Check(!BookingRules.CanConfirm(BookingStatus.Hold, expired, expired, now), "late payment cannot reclaim room");
Check(!BookingRules.CanConfirm("CancellationRequested", start, start, now), "cancel request cannot confirm again");
Check(BookingRules.CanCancel("Confirmed", start, today.AddDays(2), today, now), "confirmed future stay may cancel");
Check(!BookingRules.CanCancel(BookingStatus.Hold, expired, today.AddDays(2), today, now), "expired hold cannot cancel");
Check(!BookingRules.CanCancel("Confirmed", start, today, today, now), "stay starting today cannot cancel");
Check(BookingRules.ValidateDates(today.AddDays(1), today.AddDays(2), today) is null, "valid stay dates");
Check(BookingRules.ValidateDates(today, today, today) is not null, "zero-night stay rejected");
Check(BookingRules.ValidateGuests(2, 1, 1) is null, "valid guests");
Check(BookingRules.ValidateGuests(0, 1, 1) is not null, "adult required");
Check(BookingRules.ValidateCapacity(5, 2, 1, 7) is null, "guest mix accepted at total capacity");
Check(BookingRules.ValidateCapacity(6, 1, 1, 7) is null, "adult-heavy guest mix accepted when total capacity fits");
Check(BookingRules.ValidateCapacity(4, 3, 1, 7) is null, "child-heavy guest mix accepted when total capacity fits");
Check(BookingRules.ValidateCapacity(6, 2, 1, 7) == "Tổng số khách vượt quá sức chứa của phòng.", "total capacity enforced");
Check(BookingRules.ExtraFee(5, 2, 2, 100000, 3) == 300000, "extra guest fee uses total guests and nights");
var mixedGuestFees = BookingRules.ExtraGuestFees(3, 1, 2, 1, 150000, 100000, 2);
Check(mixedGuestFees.ExtraAdults == 1 && mixedGuestFees.ExtraChildren == 1 && mixedGuestFees.Total == 500000, "adult and child surcharges share total capacity but use separate rates");
Check(BookingRules.Deposit(1_000_000, .3m) == 300_000, "deposit is based on room amount");
var earlyCancellation = BookingRules.Cancellation(300_000, 8, 100);
Check(earlyCancellation.Refund == 300_000 && earlyCancellation.Penalty == 0, "early cancellation refunds paid amount");
var lateCancellation = BookingRules.Cancellation(300_000, 7, 50);
Check(lateCancellation.Refund == 150_000 && lateCancellation.Penalty == 150_000, "seven-day cancellation refunds half");
Check(BookingRules.RoomChangeDifference(700_000, 500_000, 2) == 400_000, "room change price difference");
Check(BookingRules.Balance(2_000_000, 300_000, 600_000) == 1_700_000, "running balance");
var dynamicPolicy = new BookingPolicySnapshot(1, 2, 25, 21, 7, .12m, "Percent", 50, false,
    [new(15, null, 100), new(8, 14, 80), new(3, 7, 50), new(0, 2, 0)],
    [new(1, 120, "Fixed", 150_000), new(121, null, "NightlyPercent", 50)]);
Check(PolicyService.RefundPercent(dynamicPolicy, 10) == 80, "dynamic cancellation tier");
Check(PolicyService.RefundPercent(dynamicPolicy, 1) == 0, "dynamic non-refundable tier");
Check(PolicyService.LateCheckoutFee(dynamicPolicy, 90, 1_000_000) == 150_000, "fixed late checkout tier");
Check(PolicyService.LateCheckoutFee(dynamicPolicy, 240, 1_000_000) == 500_000, "nightly percentage late checkout tier");
Check(PolicyService.ParseSnapshot(PolicyService.Serialize(dynamicPolicy)).HoldMinutes == 25, "policy snapshot round trip");
var sunrisePolicy = PolicyService.DefaultSnapshot();
Check(PolicyService.RefundPercent(sunrisePolicy, 14) == 100, "14-day cancellation receives full refund");
Check(PolicyService.RefundPercent(sunrisePolicy, 13) == 70, "13-day cancellation receives 70 percent refund");
Check(PolicyService.RefundPercent(sunrisePolicy, 7) == 70, "7-day cancellation receives 70 percent refund");
Check(PolicyService.RefundPercent(sunrisePolicy, 6) == 50, "6-day cancellation receives 50 percent refund");
Check(PolicyService.RefundPercent(sunrisePolicy, 3) == 50, "3-day cancellation receives 50 percent refund");
Check(PolicyService.RefundPercent(sunrisePolicy, 2) == 0, "under 3-day cancellation is non-refundable");
Check(PolicyService.LateCheckoutFee(sunrisePolicy, 179, 1_000_000) == 300_000, "late checkout before 15:00 costs 30 percent");
Check(PolicyService.LateCheckoutFee(sunrisePolicy, 180, 1_000_000) == 500_000, "late checkout at 15:00 costs 50 percent");
Check(PolicyService.LateCheckoutFee(sunrisePolicy, 359, 1_000_000) == 500_000, "late checkout before 18:00 costs 50 percent");
Check(PolicyService.LateCheckoutFee(sunrisePolicy, 360, 1_000_000) == 1_000_000, "late checkout at 18:00 costs 100 percent");
Check(CompensationRules.RequestedAmount(2, 1_000_000, 20) == 1_600_000, "compensation applies quantity and depreciation");
Check(CompensationRules.RequestedAmount(2, 1_000_000, 0, 700_000) == 1_400_000, "compensation respects per-item maximum");
Console.WriteLine("Booking rule checks passed.");
