namespace HomestayAuth.Api.Domain.Entities;

// One record per booking the host released as a no-show: who did it, the money outcome, and the guest's dispute.
public class BookingNoShow
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public long MarkedBy { get; set; }
    public DateTime MarkedAt { get; set; }
    public required string ContactNote { get; set; }
    public required string Penalty { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal RetainedAmount { get; set; }
    public decimal RefundAmount { get; set; }
    public string? DisputeStatus { get; set; }
    public string? DisputeReason { get; set; }
    public DateTime? DisputedAt { get; set; }
    public long? ResolvedBy { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ResolutionNote { get; set; }
}

public static class NoShowDisputeStatus
{
    public const string Pending = "Pending";
    public const string Accepted = "Accepted";
    public const string Rejected = "Rejected";
}
