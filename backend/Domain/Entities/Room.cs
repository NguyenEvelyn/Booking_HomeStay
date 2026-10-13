namespace HomestayAuth.Api.Domain.Entities;

public class Room
{
    public long Id { get; set; }
    public long RoomTypeId { get; set; }
    public required string RoomNumber { get; set; }
    public int? FloorNumber { get; set; }
    public required string Status { get; set; }
    public string? Note { get; set; }
    public string CleaningStatus { get; set; } = "Clean";
    public DateTime? CleaningStartedAt { get; set; }
    public DateTime? CleaningCompletedAt { get; set; }
    public string? CleaningChecklistJson { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public RoomType RoomType { get; set; } = null!;
    public ICollection<RoomImage> Images { get; set; } = [];
}
