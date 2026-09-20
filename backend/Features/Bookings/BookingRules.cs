namespace HomestayAuth.Api.Features.Bookings;

public static class BookingRules
{
    public const int HoldMinutes = 15;
    public static readonly string[] ReservedStatuses = ["Confirmed", "CheckedIn", "CancellationRequested"];
    public static readonly string[] InventoryStatuses = ["Available", "Occupied", "Cleaning"];
    public static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

    public static bool IsActiveHold(string status, DateTime updatedAt, DateTime now) =>
        status == "PendingPayment" && updatedAt > now.AddMinutes(-HoldMinutes);

    public static bool CanConfirm(string bookingStatus, DateTime holdStartedAt, DateTime paymentCreatedAt, DateTime now) =>
        IsActiveHold(bookingStatus, holdStartedAt, now) && paymentCreatedAt >= holdStartedAt;

    public static bool CanCancel(string status, DateTime holdStartedAt, DateOnly checkIn, DateOnly today, DateTime now) =>
        checkIn > today && (status == "Confirmed" || IsActiveHold(status, holdStartedAt, now));

    public static string? ValidateDates(DateOnly checkIn, DateOnly checkOut, DateOnly today) =>
        checkIn < today || checkOut <= checkIn ? "Ngày nhận hoặc trả phòng không hợp lệ." : null;

    public static string? ValidateGuests(int adults, int children, int quantity) =>
        adults < 1 || adults > 300 || children < 0 || children > 300 || quantity < 1 || quantity > 10
            ? "Số khách hoặc số phòng không hợp lệ." : null;

    public static decimal ExtraFee(int guests, int baseCapacity, int quantity, decimal fee, int nights) =>
        Math.Max(0, guests - baseCapacity * quantity) * fee * nights;
}
