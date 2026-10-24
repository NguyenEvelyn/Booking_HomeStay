using HomestayAuth.Api.Features.Bookings;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Features.Admin.Controllers;

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
Check(BookingRules.HostCancellation(1_000_000, null) is (1_000_000, 0, 100, null), "host cancellation refunds in full by default");
Check(BookingRules.HostCancellation(1_000_000, 400_000) is (400_000, 600_000, 40, null), "host override keeps the remainder as fee");
Check(BookingRules.HostCancellation(1_000_000, -1).Error is not null, "host override cannot be negative");
Check(BookingRules.HostCancellation(1_000_000, 1_000_001).Error is not null, "host override cannot exceed paid amount");
Check(BookingRules.HostCancellation(0, null) is (0, 0, 100, null), "unpaid booking cancels without refund");
var lockNamespaces = new[] { AdvisoryLocks.BookingNamespace, AdvisoryLocks.RoomTypeNamespace, AdvisoryLocks.VoucherNamespace, AdvisoryLocks.HomestayPolicyNamespace, AdvisoryLocks.DealNamespace };
Check(lockNamespaces.Distinct().Count() == lockNamespaces.Length, "advisory lock namespaces are distinct");
Check(ImageUpload.MatchesSignature(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }, "image/jpeg"), "jpeg magic bytes are accepted");
Check(ImageUpload.MatchesSignature(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, "image/png"), "png magic bytes are accepted");
Check(ImageUpload.MatchesSignature("RIFF\0\0\0\0WEBP"u8, "image/webp"), "webp magic bytes are accepted");
Check(!ImageUpload.MatchesSignature("<svg onload=alert(1)>"u8, "image/png"), "html/svg renamed to .png is rejected");
Check(!ImageUpload.MatchesSignature(new byte[] { 0xFF, 0xD8, 0xFF }, "image/png"), "jpeg bytes declared as png are rejected");
Check(ImageUpload.IsAllowedUrl("https://images.unsplash.com/photo.jpg"), "https image link is allowed");
Check(!ImageUpload.IsAllowedUrl("data:image/png;base64,AAAA"), "data url is rejected");
Check(!ImageUpload.IsAllowedUrl("javascript:alert(1)"), "javascript url is rejected");
Check(!ImageUpload.IsAllowedUrl("http://evil.example/x.jpg"), "plain http is rejected outside localhost");
Check(!ImageUpload.IsAllowedUrl("https://a.example/" + new string('x', 600)), "url longer than image_url column is rejected");
var usedVoucher = new HomestayAuth.Api.Domain.Entities.Voucher { Code = "SUMMER", Name = "Hè", DiscountType = "Percentage", DiscountValue = 10,
    MinimumBookingAmount = 0, ValidFrom = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc), ValidUntil = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc) };
VoucherRequest Edit(string code = "summer", decimal value = 10, string fundedBy = "Platform", int? limit = 100, DateTime? until = null) =>
    new(code, "Hè rực rỡ", null, "Percentage", value, null, 0, usedVoucher.ValidFrom, until ?? usedVoucher.ValidUntil, limit, 1, null, "Active", fundedBy, false);
Check(!AdminVouchersController.PricingChanged(usedVoucher, Edit(until: new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc))), "used voucher may be extended, renamed and hidden");
Check(AdminVouchersController.PricingChanged(usedVoucher, Edit(value: 20)), "used voucher cannot change its discount");
Check(AdminVouchersController.PricingChanged(usedVoucher, Edit(code: "SUMMER2")), "used voucher cannot change its code");
Check(AdminVouchersController.PricingChanged(usedVoucher, Edit(fundedBy: "Host")), "used voucher cannot change who pays");
var vn = NoShowRules.Zone("Asia/Ho_Chi_Minh");
var noShowPolicy = new HomestayAuth.Api.Domain.Entities.NoShowPolicy();
var checkInDay = new DateOnly(2026, 11, 1);
var standardDeadline = NoShowRules.DeadlineUtc(checkInDay, new TimeOnly(14, 0), vn, noShowPolicy, null);
Check(standardDeadline == new DateTime(2026, 11, 1, 13, 0, 0, DateTimeKind.Utc), "no-show deadline is check-in 14:00 + 6h grace, i.e. 20:00 Vietnam time");
var lateArrival = new DateTime(2026, 11, 1, 16, 0, 0, DateTimeKind.Utc); // 23:00 Vietnam time
Check(NoShowRules.DeadlineUtc(checkInDay, new TimeOnly(14, 0), vn, noShowPolicy, lateArrival) == lateArrival.AddHours(1), "announced late arrival postpones the deadline by one hour after it");
Check(NoShowRules.DeadlineUtc(checkInDay, new TimeOnly(14, 0), vn, noShowPolicy, new DateTime(2026, 11, 1, 8, 0, 0, DateTimeKind.Utc)) == standardDeadline, "early announced arrival never shortens the grace period");
Check(NoShowRules.ValidateExpectedArrival(checkInDay, new TimeOnly(14, 0), vn, lateArrival, new DateTime(2026, 11, 1, 10, 0, 0, DateTimeKind.Utc)) is null, "late arrival at 23:00 on check-in day is accepted");
Check(NoShowRules.ValidateExpectedArrival(checkInDay, new TimeOnly(14, 0), vn, new DateTime(2026, 11, 2, 2, 0, 0, DateTimeKind.Utc), new DateTime(2026, 11, 1, 10, 0, 0, DateTimeKind.Utc)) is not null, "late arrival after 06:00 next morning is rejected");
Check(NoShowRules.ValidateExpectedArrival(checkInDay, new TimeOnly(14, 0), vn, new DateTime(2026, 11, 1, 5, 0, 0, DateTimeKind.Utc), new DateTime(2026, 11, 1, 4, 0, 0, DateTimeKind.Utc)) is not null, "arrival before check-in time is not a late arrival");
Check(NoShowRules.Settlement(300_000, 300_000, 1_000_000, 2, noShowPolicy) == (300_000, 0), "deposit-only booking: host keeps the deposit");
Check(NoShowRules.Settlement(1_000_000, 300_000, 1_000_000, 2, noShowPolicy) == (300_000, 700_000), "fully paid booking: deposit kept, rest refunded");
Check(NoShowRules.Settlement(1_000_000, 300_000, 1_000_000, 2, noShowPolicy with { Penalty = "FirstNight" }) == (500_000, 500_000), "first-night penalty keeps one night's price");
Check(NoShowRules.Settlement(1_000_000, 300_000, 1_000_000, 2, noShowPolicy with { RemainingRefundPercent = 50 }) == (650_000, 350_000), "partial refund of the remainder");
Check(NoShowRules.Settlement(100_000, 300_000, 1_000_000, 2, noShowPolicy) == (100_000, 0), "penalty is capped at what was paid");
Check(NoShowRules.ValidatePolicy(noShowPolicy with { GraceHours = 0 }) is not null, "grace hours must be at least 1");
var dealNow = new DateTime(2026, 11, 1, 3, 0, 0, DateTimeKind.Utc); // 10:00 Vietnam time
var dealToday = new DateOnly(2026, 11, 1);
var deal = new HomestayAuth.Api.Domain.Entities.RoomDeal { StartDate = dealToday, EndDate = dealToday.AddDays(2), DiscountPercent = 30, RoomsLimit = 2,
    SaleEndsAt = DealRules.DefaultSaleEndUtc(dealToday, vn, dealNow) };
Check(deal.SaleEndsAt == new DateTime(2026, 11, 1, 15, 0, 0, DateTimeKind.Utc), "deal sale ends 22:00 Vietnam time on the first night by default");
Check(DealRules.Covers(deal, dealToday, dealToday.AddDays(1), dealToday, dealNow), "deal covers a one-night stay inside its nights");
Check(!DealRules.Covers(deal, dealToday, dealToday.AddDays(3), dealToday, dealNow), "deal never applies when the stay runs past its nights");
Check(!DealRules.Covers(deal, dealToday, dealToday.AddDays(1), dealToday, deal.SaleEndsAt), "deal stops applying at its sale end");
var endedDeal = new HomestayAuth.Api.Domain.Entities.RoomDeal { StartDate = deal.StartDate, EndDate = deal.EndDate, DiscountPercent = 30, RoomsLimit = 2,
    SaleEndsAt = deal.SaleEndsAt, Status = "Ended" };
Check(!DealRules.Covers(endedDeal, dealToday, dealToday.AddDays(1), dealToday, dealNow), "ended deal does not apply");
Check(DealRules.Validate(dealToday, dealToday.AddDays(1), 30, 1, deal.SaleEndsAt, dealToday, dealNow, vn) is null, "valid tonight deal");
Check(DealRules.Validate(dealToday, dealToday.AddDays(1), 80, 1, deal.SaleEndsAt, dealToday, dealNow, vn) is not null, "discount above 70% is rejected");
Check(DealRules.Validate(dealToday.AddDays(5), dealToday.AddDays(6), 30, 1, deal.SaleEndsAt.AddDays(5), dealToday, dealNow, vn) is not null, "deal more than 3 days ahead is rejected");
Check(DealRules.Validate(dealToday, dealToday.AddDays(4), 30, 1, deal.SaleEndsAt, dealToday, dealNow, vn) is not null, "deal longer than 3 nights is rejected");
Check(DealRules.Validate(dealToday, dealToday.AddDays(1), 30, 1, deal.SaleEndsAt.AddDays(1), dealToday, dealNow, vn) is not null, "deal must stop selling before midnight of the first night");
Check(DealRules.NonRefundable(PolicyService.DefaultSnapshot()).CancellationTiers is [{ RefundPercent: 0, MinimumDays: 0, MaximumDays: null }], "deal bookings are non-refundable");
var bannerStart = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);
string? Banner(string targetType = "Homestay", long? targetId = 5, string? query = null, string image = "https://cdn.example/b.jpg", int days = 14, string title = "Ưu đãi cuối tuần") =>
    HomestayAuth.Api.Features.Admin.BannerRules.Validate(title, null, image, "HomeHero", targetType, targetId, query, bannerStart, bannerStart.AddDays(days), 10);
Check(Banner() is null, "valid homestay banner");
Check(Banner("Search", null, "Kiên Giang") is null, "valid search banner by province");
Check(Banner("Search", null, null) is not null, "search banner needs a province");
Check(Banner("Url", 5) is not null, "free URL targets are not allowed");
Check(Banner(image: "javascript:alert(1)") is not null, "banner image must be an https link");
Check(Banner(days: 120) is not null, "banner runs at most 90 days");
Check(Banner(title: "Hi") is not null, "banner title needs at least 3 characters");
var liveBanner = new HomestayAuth.Api.Domain.Entities.Banner { Title = "x", ImageUrl = "https://a/b.jpg", TargetType = "Homestay", StartsAt = bannerStart, EndsAt = bannerStart.AddDays(1), Status = "Active" };
Check(HomestayAuth.Api.Features.Admin.BannerRules.IsLive(liveBanner, bannerStart.AddHours(1)), "active banner inside its window is live");
Check(!HomestayAuth.Api.Features.Admin.BannerRules.IsLive(liveBanner, bannerStart.AddDays(1)), "banner stops at its end time");
Console.WriteLine("Booking rule checks passed.");
