namespace HomestayAuth.Api.Domain.Entities;

public class HomestayService
{
    public long Id { get; set; }
    public long HomestayId { get; set; }
    public required string Name { get; set; }
    public required string Category { get; set; }
    public string? Description { get; set; }
    public string Unit { get; set; } = "lần";
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class GuestServiceRequest
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public long? HomestayServiceId { get; set; }
    public long CustomerId { get; set; }
    public required string RequestType { get; set; }
    public required string Title { get; set; }
    public string DetailsJson { get; set; } = "{}";
    public int Quantity { get; set; } = 1;
    public DateTime? RequestedFor { get; set; }
    public decimal EstimatedAmount { get; set; }
    public decimal? ApprovedAmount { get; set; }
    public string Status { get; set; } = "Pending";
    public string? HostResponse { get; set; }
    public string? RejectReasonCode { get; set; }
    public string? RejectReasonNote { get; set; }
    public DateTime ResponseDueAt { get; set; }
    public DateTime? RespondedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
