namespace HomestayAuth.Api.Domain.Entities;

public class HomestayImage
{
    public long Id { get; set; }
    public long HomestayId { get; set; }
    public required string ImageUrl { get; set; }
    public string? Caption { get; set; }
    public bool IsThumbnail { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public Homestay Homestay { get; set; } = null!;
}

public class RoomTypeImage
{
    public long Id { get; set; }
    public long RoomTypeId { get; set; }
    public required string ImageUrl { get; set; }
    public string? Caption { get; set; }
    public bool IsThumbnail { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public RoomType RoomType { get; set; } = null!;
}
