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
    public decimal CommissionRate { get; set; }
    public required string Status { get; set; }
    public string? CustomerNote { get; set; }
    public string? RecommendationSessionId { get; set; }
    public string? HostNote { get; set; }
    public DateTime? HostViewedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<BookingDetail> Details { get; set; } = [];
    public ICollection<Payment> Payments { get; set; } = [];
}
