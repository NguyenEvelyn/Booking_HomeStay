namespace HomestayAuth.Api.Features.Bookings;

public static class BookingRules
{
    public const int HoldMinutes = 15;
    public static readonly string[] ReservedStatuses = ["Confirmed", "CheckedIn", "CheckoutPendingPayment"];
    public static readonly string[] InventoryStatuses = ["Available", "Occupied", "Cleaning"];
    public static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

    // A host never books (or reviews) their own homestay as a guest: it would fake reviews, demand and
    // platform-funded voucher reimbursements. Bookings for real guests go through the host manual booking.
    public const string OwnHomestayMessage = "Bạn là chủ homestay này nên không thể tự đặt phòng. Hãy dùng chức năng Đặt phòng hộ khách trong trang quản lý.";
    public static bool IsOwnHomestay(long homestayHostId, long? userId) => userId is > 0 && homestayHostId == userId;

    public static bool IsActiveHold(string status, DateTime holdExpiresAt, DateTime now) =>
        status == BookingStatus.Hold && holdExpiresAt > now;

    public static bool CanConfirm(string bookingStatus, DateTime holdExpiresAt, DateTime paymentCreatedAt, DateTime now) =>
        IsActiveHold(bookingStatus, holdExpiresAt, now) && paymentCreatedAt <= holdExpiresAt;

    public static bool CanCancel(string status, DateTime holdExpiresAt, DateOnly checkIn, DateOnly today, DateTime now) =>
        checkIn > today && (status == BookingStatus.Confirmed || IsActiveHold(status, holdExpiresAt, now));

    public static string? ValidateDates(DateOnly checkIn, DateOnly checkOut, DateOnly today) =>
        checkIn < today || checkOut <= checkIn ? "Ngày nhận hoặc trả phòng không hợp lệ." : null;

    public static string? ValidateGuests(int adults, int children, int quantity) =>
        adults < 1 || adults > 300 || children < 0 || children > 300 || quantity < 1 || quantity > 10
            ? "Số khách hoặc số phòng không hợp lệ." : null;

    public static string? ValidateCapacity(int adults, int children, int quantity, int maxCapacity) =>
        adults + children > maxCapacity * quantity
            ? "Tổng số khách vượt quá sức chứa của phòng."
            : null;

    public static decimal ExtraFee(int guests, int baseCapacity, int quantity, decimal fee, int nights) =>
        Math.Max(0, guests - baseCapacity * quantity) * fee * nights;

    public static (int ExtraAdults, int ExtraChildren, decimal Total) ExtraGuestFees(int adults, int children, int baseCapacity, int quantity, decimal adultFee, decimal childFee, int nights)
    {
        var included = baseCapacity * quantity;
        var extraAdults = Math.Max(0, adults - included);
        var remainingIncluded = Math.Max(0, included - adults);
        var extraChildren = Math.Max(0, children - remainingIncluded);
        return (extraAdults, extraChildren, (extraAdults * adultFee + extraChildren * childFee) * nights);
    }

    public static decimal Deposit(decimal roomAmount, decimal depositPercent) =>
        decimal.Round(roomAmount * Math.Clamp(depositPercent, 0m, 1m), 0, MidpointRounding.AwayFromZero);

    public static (decimal Refund, decimal Penalty, decimal Percent) Cancellation(decimal paidAmount, int daysBeforeCheckIn, decimal refundPercent)
    {
        var percent = Math.Clamp(refundPercent, 0m, 100m);
        var refund = decimal.Round(paidAmount * percent / 100m, 0, MidpointRounding.AwayFromZero);
        return (refund, paidAmount - refund, percent);
    }

    // Host-initiated cancellation: full refund by default; an override may only lower it within [0, paid].
    public static (decimal Refund, decimal Penalty, decimal Percent, string? Error) HostCancellation(decimal paidAmount, decimal? overrideRefund)
    {
        var refund = overrideRefund ?? paidAmount;
        if (refund < 0 || refund > paidAmount)
            return (0, 0, 0, $"Số tiền hoàn phải nằm trong khoảng 0 – {paidAmount:N0}đ (số tiền khách đã thanh toán).");
        var percent = paidAmount > 0 ? decimal.Round(refund * 100m / paidAmount, 2) : 100m;
        return (refund, paidAmount - refund, percent, null);
    }

    public static decimal RoomChangeDifference(decimal newNightlyPrice, decimal oldNightlyPrice, int remainingNights) =>
        (newNightlyPrice - oldNightlyPrice) * Math.Max(0, remainingNights);

    public static decimal Balance(decimal roomAmount, decimal additionalCharges, decimal totalPaid) =>
        roomAmount + additionalCharges - totalPaid;

    public static decimal LateCheckoutFee(int extraHours, decimal fixedFee1To3Hours, decimal halfDayFee) =>
        extraHours <= 0 ? 0 : extraHours <= 3 ? fixedFee1To3Hours : extraHours > 6 ? halfDayFee : fixedFee1To3Hours * 2;
}

public static class BookingStatus
{
    public const string Hold = "Hold";
    public const string Confirmed = "Confirmed";
    public const string CheckedIn = "CheckedIn";
    public const string CheckoutPendingPayment = "CheckoutPendingPayment";
    public const string CheckedOut = "CheckedOut";
    public const string Cancelled = "Cancelled";
    public const string NoShow = "NoShow";
    // Unpaid holds end as Expired (never Cancelled) so the guest can still retry payment
    // and cancellation statistics only count real cancellations.
    public const string Expired = "Expired";
    public const string PaymentFailed = "PaymentFailed";
}

public static class PaymentStatus
{
    public const string Unpaid = "Unpaid";
    public const string Deposited = "Deposited";
    public const string PartiallyPaid = "PartiallyPaid";
    public const string Paid = "Paid";
    public const string RefundPending = "RefundPending";
    public const string PartiallyRefunded = "PartiallyRefunded";
    public const string Refunded = "Refunded";
}

public static class ChargeStatus
{
    public const string PendingGuestConfirmation = "PendingGuestConfirmation";
    public const string Approved = "Approved";
    public const string Disputed = "Disputed";
    public const string Adjusted = "Adjusted";
    public const string Waived = "Waived";
    public const string Paid = "Paid";
}
