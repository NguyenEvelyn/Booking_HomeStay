namespace HomestayAuth.Api.Domain.Entities;

public sealed class RecommendationEvent
{
    public long Id { get; set; }
    public DateTime OccurredAt { get; set; }
    public long? CustomerId { get; set; }
    public string SessionId { get; set; } = "";
    public string EventType { get; set; } = "";
    public long? HomestayId { get; set; }
    public long? BookingId { get; set; }
    public string QueryData { get; set; } = "{}";
    public string Source { get; set; } = "real";
}
