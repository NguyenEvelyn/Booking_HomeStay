using HomestayAuth.Api.Features.Bookings;

static void Check(bool condition, string name)
{
    if (!condition) throw new Exception($"Booking rule failed: {name}");
}

var now = new DateTime(2026, 9, 20, 10, 0, 0, DateTimeKind.Utc);
var start = now.AddMinutes(-14);
var expired = now.AddMinutes(-16);
var today = DateOnly.FromDateTime(now);

Check(BookingRules.IsActiveHold("PendingPayment", start, now), "active 15-minute hold");
Check(!BookingRules.IsActiveHold("PendingPayment", expired, now), "expired hold");
Check(!BookingRules.IsActiveHold("Confirmed", start, now), "confirmed booking is not a hold");
Check(BookingRules.CanConfirm("PendingPayment", start, start, now), "current payment may confirm");
Check(!BookingRules.CanConfirm("PendingPayment", start, start.AddMinutes(-1), now), "old attempt cannot confirm new hold");
Check(!BookingRules.CanConfirm("PendingPayment", expired, expired, now), "late payment cannot reclaim room");
Check(!BookingRules.CanConfirm("CancellationRequested", start, start, now), "cancel request cannot confirm again");
Check(BookingRules.CanCancel("Confirmed", start, today.AddDays(2), today, now), "confirmed future stay may cancel");
Check(!BookingRules.CanCancel("PendingPayment", expired, today.AddDays(2), today, now), "expired hold cannot cancel");
Check(!BookingRules.CanCancel("Confirmed", start, today, today, now), "stay starting today cannot cancel");
Check(BookingRules.ValidateDates(today.AddDays(1), today.AddDays(2), today) is null, "valid stay dates");
Check(BookingRules.ValidateDates(today, today, today) is not null, "zero-night stay rejected");
Check(BookingRules.ValidateGuests(2, 1, 1) is null, "valid guests");
Check(BookingRules.ValidateGuests(0, 1, 1) is not null, "adult required");
Check(BookingRules.ExtraFee(5, 2, 2, 100000, 3) == 300000, "extra guest fee uses total guests and nights");
Console.WriteLine("Booking rule checks passed.");
