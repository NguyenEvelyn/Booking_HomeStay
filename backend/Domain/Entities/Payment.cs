namespace HomestayAuth.Api.Domain.Entities;

public class Payment
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public required string TransactionCode { get; set; }
    public required string PaymentMethod { get; set; }
    public required string TransactionType { get; set; }
    public decimal Amount { get; set; }
    public required string Status { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? GatewayResponse { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Booking Booking { get; set; } = null!;
}
