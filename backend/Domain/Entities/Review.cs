namespace HomestayAuth.Api.Domain.Entities;

public class Review
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public long CustomerId { get; set; }
    public long HomestayId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public int? CleanlinessRating { get; set; }
    public int? LocationRating { get; set; }
    public int? HostRating { get; set; }
    public int? ValueRating { get; set; }
    public string? HostReply { get; set; }
    public DateTime? HostRepliedAt { get; set; }
    public required string Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
