namespace HomestayAuth.Api.Domain.Entities;

public class Homestay
{
    public long Id { get; set; }
    public long HostId { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
    public required string AddressLine { get; set; }
    public required string Ward { get; set; }
    public required string District { get; set; }
    public required string Province { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public TimeOnly CheckInTime { get; set; }
    public TimeOnly CheckOutTime { get; set; }
    public required string Status { get; set; }
    public string? RejectionReason { get; set; }
    public long? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<RoomType> RoomTypes { get; set; } = [];
    public ICollection<HomestayImage> Images { get; set; } = [];
    public ICollection<HomestayAmenity> HomestayAmenities { get; set; } = [];
}
