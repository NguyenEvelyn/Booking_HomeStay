namespace HomestayAuth.Api.Domain.Entities;

public class ReviewReport
{
    public long Id { get; set; }
    public long ReviewId { get; set; }
    public long HostId { get; set; }
    public required string Reason { get; set; }
    public string? Detail { get; set; }
    public required string Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
