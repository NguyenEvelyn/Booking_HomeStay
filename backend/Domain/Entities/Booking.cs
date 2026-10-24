namespace HomestayAuth.Api.Domain.Entities;

public class Booking
{
    public long Id { get; set; }
    public required string BookingCode { get; set; }
    public long CustomerId { get; set; }
    public long HomestayId { get; set; }
    public DateOnly CheckInDate { get; set; }
    public DateOnly CheckOutDate { get; set; }
    public int AdultCount { get; set; }
    public int ChildCount { get; set; }
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal ServiceFee { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal RoomAmount { get; set; }
    public decimal DepositAmount { get; set; }
    public string PaymentStatus { get; set; } = "Unpaid";
    public DateTime? HoldExpiresAt { get; set; }
    public string PricingSnapshotJson { get; set; } = "{}";
    public string PolicySnapshotJson { get; set; } = "{}";
    public DateOnly ReviewCreateUntil { get; set; }
    public DateOnly ReviewEditUntil { get; set; }
    public decimal CommissionRate { get; set; }
    public required string Status { get; set; }
    public string? CustomerNote { get; set; }
    public string? RecommendationSessionId { get; set; }
    public string? HostNote { get; set; }
    public DateTime? HostViewedAt { get; set; }
    public string? ContactName { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public string? GuestName { get; set; }
    public int ContactNameEditCount { get; set; }
    public DateTime? ContactUpdatedAt { get; set; }
    // Guest-announced late arrival: postpones the no-show deadline (see NoShowRules.DeadlineUtc).
    public DateTime? ExpectedArrivalAt { get; set; }
    public string? LateArrivalNote { get; set; }
    public DateTime? NoShowReminderSentAt { get; set; }
    // Last-minute deal this booking was sold under (non-refundable, counts toward RoomDeal.RoomsLimit).
    public long? RoomDealId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<BookingDetail> Details { get; set; } = [];
    public ICollection<Payment> Payments { get; set; } = [];
    public ICollection<AdditionalCharge> AdditionalCharges { get; set; } = [];
    public ICollection<BookingRoomStay> RoomStays { get; set; } = [];
    public ICollection<BookingGuest> Guests { get; set; } = [];
    public Homestay Homestay { get; set; } = null!;
}
