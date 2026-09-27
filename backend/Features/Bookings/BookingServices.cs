using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public interface IHomestayClock
{
    DateTime UtcNow { get; }
    DateTime LocalNow(string timeZoneId);
    DateOnly LocalDate(string timeZoneId);
}

public sealed class HomestayClock : IHomestayClock
{
    public DateTime UtcNow => DateTime.UtcNow;
    public DateTime LocalNow(string timeZoneId) => TimeZoneInfo.ConvertTimeFromUtc(UtcNow, Resolve(timeZoneId));
    public DateOnly LocalDate(string timeZoneId) => DateOnly.FromDateTime(LocalNow(timeZoneId));
    private static TimeZoneInfo Resolve(string id)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"); }
    }
}

public sealed class RoomInventoryService(AppDbContext db)
{
    public Task LockRoom(long roomId) => db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock({0})", roomId);

    public IQueryable<BookingRoomStay> BlockingStays(long roomId, DateOnly from, DateOnly to, long? excludingBookingId = null) =>
        db.BookingRoomStays.Where(x => x.RoomId == roomId && x.StartDate < to && x.EndDate > from && x.Status == "Active" && (!excludingBookingId.HasValue || x.BookingId != excludingBookingId));

    public async Task<bool> IsAvailable(long roomId, DateOnly from, DateOnly to, long? excludingBookingId = null)
    {
        if (await BlockingStays(roomId, from, to, excludingBookingId).AnyAsync()) return false;
        return !await BookingAvailability.BlockingDetails(db, from, to, DateTime.UtcNow)
            .AnyAsync(x => x.RoomId == roomId && (!excludingBookingId.HasValue || x.BookingId != excludingBookingId));
    }

    public void Allocate(Booking booking, long roomId, DateOnly from, DateOnly to, decimal nightlyPrice) =>
        booking.RoomStays.Add(new BookingRoomStay { RoomId = roomId, StartDate = from, EndDate = to, NightlyPrice = nightlyPrice, Status = "Active", CreatedAt = DateTime.UtcNow });

    public async Task ChangeRoom(Booking booking, long oldRoomId, long newRoomId, DateOnly changeDate, decimal newNightlyPrice)
    {
        var current = await db.BookingRoomStays.SingleAsync(x => x.BookingId == booking.Id && x.RoomId == oldRoomId && x.Status == "Active" && x.StartDate <= changeDate && x.EndDate > changeDate);
        current.EndDate = changeDate; current.Status = current.StartDate == changeDate ? "Replaced" : "Completed";
        db.BookingRoomStays.Add(new BookingRoomStay { BookingId = booking.Id, RoomId = newRoomId, StartDate = changeDate, EndDate = booking.CheckOutDate, NightlyPrice = newNightlyPrice, Status = "Active", CreatedAt = DateTime.UtcNow });
    }
}

public sealed class PaymentService(AppDbContext db)
{
    public async Task<decimal> TotalPaid(long bookingId) =>
        (await db.Payments.Where(x => x.BookingId == bookingId && x.TransactionType != "Refund" && x.Status == "Success").SumAsync(x => (decimal?)x.Amount) ?? 0)
        - (await db.Payments.Where(x => x.BookingId == bookingId && x.TransactionType == "Refund" && x.Status == "Success").SumAsync(x => (decimal?)x.Amount) ?? 0);

    public void QueueRefund(long bookingId, decimal amount, string reason, string paymentMethod = "Original")
    {
        if (amount <= 0) return;
        var payment = new Payment { BookingId = bookingId, TransactionCode = $"RF-{Guid.NewGuid():N}", PaymentMethod = paymentMethod, TransactionType = "Refund", Amount = amount, Status = "Pending", GatewayResponse = reason, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        db.Payments.Add(payment);
        db.OutboxMessages.Add(new OutboxMessage { Type = "refund.requested", PayloadJson = JsonSerializer.Serialize(new { bookingId, paymentTransactionCode = payment.TransactionCode, amount, reason }), Status = "Pending", AvailableAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow });
    }

    public void RecordSuccessfulPayment(Booking booking, decimal amount, string method, string transactionType)
    {
        db.Payments.Add(new Payment { BookingId = booking.Id, TransactionCode = $"PAY-{Guid.NewGuid():N}", PaymentMethod = method, TransactionType = transactionType, Amount = amount, Status = "Success", PaidAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
    }

    public async Task<decimal> ApprovedChargeTotal(long bookingId) => await db.AdditionalCharges
        .Where(x => x.BookingId == bookingId && (x.Status == ChargeStatus.Approved || x.Status == ChargeStatus.Adjusted || x.Status == ChargeStatus.Paid))
        .SumAsync(x => (decimal?)x.TotalPrice) ?? 0;

    public async Task<decimal> BalanceDue(Booking booking) => BookingRules.Balance(booking.RoomAmount, await ApprovedChargeTotal(booking.Id), await TotalPaid(booking.Id));

    public async Task RefreshPaymentStatus(Booking booking)
    {
        var grossPaid = await db.Payments.Where(x => x.BookingId == booking.Id && x.TransactionType != "Refund" && x.Status == "Success").SumAsync(x => (decimal?)x.Amount) ?? 0;
        var successfulRefund = await db.Payments.Where(x => x.BookingId == booking.Id && x.TransactionType == "Refund" && x.Status == "Success").SumAsync(x => (decimal?)x.Amount) ?? 0;
        var pendingRefund = await db.Payments.AnyAsync(x => x.BookingId == booking.Id && x.TransactionType == "Refund" && x.Status == "Pending");
        var totalDue = booking.RoomAmount + await ApprovedChargeTotal(booking.Id);
        booking.PaymentStatus = pendingRefund ? PaymentStatus.RefundPending
            : successfulRefund >= grossPaid && grossPaid > 0 ? PaymentStatus.Refunded
            : successfulRefund > 0 ? PaymentStatus.PartiallyRefunded
            : grossPaid >= totalDue && totalDue > 0 ? PaymentStatus.Paid
            : grossPaid >= booking.DepositAmount && booking.DepositAmount > 0 ? PaymentStatus.Deposited
            : grossPaid > 0 ? PaymentStatus.PartiallyPaid : PaymentStatus.Unpaid;
    }
}

public sealed class AdditionalChargeService
{
    private static readonly HashSet<string> DamageTypes = new(StringComparer.OrdinalIgnoreCase) { "damage", "compensation", "property_damage" };
    public bool IsDamage(string type) => DamageTypes.Contains(type);
    public AdditionalCharge Create(long bookingId, string type, string description, int quantity, decimal unitPrice, long actorId, string? evidenceJson)
    {
        var damage = IsDamage(type);
        if (damage && string.IsNullOrWhiteSpace(evidenceJson)) throw new ArgumentException("Phí hư hại phải có bằng chứng.");
        return new AdditionalCharge { BookingId = bookingId, Type = type.Trim().ToLowerInvariant(), Description = description.Trim(), Quantity = quantity, UnitPrice = unitPrice, TotalPrice = quantity * unitPrice,
            Status = damage ? ChargeStatus.PendingGuestConfirmation : ChargeStatus.Approved, EvidenceJson = evidenceJson, RecordedBy = actorId, CreatedAt = DateTime.UtcNow };
    }
}

public sealed class IdempotencyService(AppDbContext db)
{
    public static string RequestHash(object request) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request)))).ToLowerInvariant();

    public async Task<IdempotencyRecord?> Find(string scope, string key, long actorId) =>
        await db.IdempotencyRecords.AsNoTracking().SingleOrDefaultAsync(x => x.Scope == scope && x.Key == key && x.ActorId == actorId && x.ExpiresAt > DateTime.UtcNow);

    public void Store(string scope, string key, long actorId, object request, int statusCode, object response) =>
        db.IdempotencyRecords.Add(new IdempotencyRecord { Scope = scope, Key = key, ActorId = actorId, RequestHash = RequestHash(request), StatusCode = statusCode, ResponseJson = JsonSerializer.Serialize(response), CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddHours(24) });
}

public sealed class BookingService(RoomInventoryService inventory)
{
    public async Task<bool> CanUseRoom(long roomId, DateOnly from, DateOnly to, long? excludingBookingId = null)
    {
        await inventory.LockRoom(roomId);
        return await inventory.IsAvailable(roomId, from, to, excludingBookingId);
    }

    public static string PricingSnapshot(RoomType roomType, decimal roomAmount, int nights) => JsonSerializer.Serialize(new { roomType.Id, roomType.Name, nightlyPrice = roomType.BasePrice, roomAmount, nights, roomType.BaseCapacity, roomType.MaxCapacity, adultExtraFee = roomType.ExtraGuestFee, roomType.ExtraChildFee, roomType.ChildMaxAge, roomType.DepositPercent });
}
