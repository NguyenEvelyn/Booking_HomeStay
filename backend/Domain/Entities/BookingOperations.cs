namespace HomestayAuth.Api.Domain.Entities;

public class AdditionalCharge
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public required string Type { get; set; }
    public required string Description { get; set; }
    public int Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public bool IsPaid { get; set; }
    public string Status { get; set; } = "Approved";
    public string? EvidenceJson { get; set; }
    public long? ReviewedBy { get; set; }
    public string? ReviewReason { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public long RecordedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public Booking Booking { get; set; } = null!;
}

public class RoomChangeLog
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public long OldRoomId { get; set; }
    public long NewRoomId { get; set; }
    public DateOnly ChangeDate { get; set; }
    public int RemainingNights { get; set; }
    public decimal PriceDifference { get; set; }
    public required string InitiatedBy { get; set; }
    public required string RequestStatus { get; set; }
    public string? Reason { get; set; }
    public long RequestedBy { get; set; }
    public long? ApprovedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class LateCheckoutRequest
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public DateTime RequestedCheckoutAt { get; set; }
    public int ExtraHours { get; set; }
    public decimal Fee { get; set; }
    public required string Status { get; set; }
    public string? Warning { get; set; }
    public long RequestedBy { get; set; }
    public long? ApprovedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public Booking Booking { get; set; } = null!;
}

public class FinalInvoice
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public decimal RoomAmount { get; set; }
    public decimal AdditionalChargesAmount { get; set; }
    public decimal TotalPaidBefore { get; set; }
    public decimal BalanceDue { get; set; }
    public required string Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
}

public class RoomInspection
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public required string Notes { get; set; }
    public string? EvidenceJson { get; set; }
    public long RecordedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class BookingRoomStay
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public long RoomId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal NightlyPrice { get; set; }
    public required string Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public Booking Booking { get; set; } = null!;
}

public class IdempotencyRecord
{
    public long Id { get; set; }
    public required string Scope { get; set; }
    public required string Key { get; set; }
    public long ActorId { get; set; }
    public required string RequestHash { get; set; }
    public int StatusCode { get; set; }
    public string? ResponseJson { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}

public class OutboxMessage
{
    public long Id { get; set; }
    public required string Type { get; set; }
    public required string PayloadJson { get; set; }
    public required string Status { get; set; }
    public int Attempts { get; set; }
    public DateTime AvailableAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; }
}
