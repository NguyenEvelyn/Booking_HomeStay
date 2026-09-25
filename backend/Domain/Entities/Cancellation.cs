namespace HomestayAuth.Api.Domain.Entities;

public class Cancellation
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public long CancelledBy { get; set; }
    public required string Reason { get; set; }
    public DateTime CancelledAt { get; set; }
    public decimal CancellationFee { get; set; }
    public decimal RefundAmount { get; set; }
    public decimal RefundPercent { get; set; }
    public decimal PaidAmountAtCancellation { get; set; }
    public long? OverrideBy { get; set; }
    public string? OverrideReason { get; set; }
    public required string Status { get; set; }
    public long? ProcessedBy { get; set; }
    public DateTime? ProcessedAt { get; set; }
}
