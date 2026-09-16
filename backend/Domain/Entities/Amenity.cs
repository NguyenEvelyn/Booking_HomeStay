namespace HomestayAuth.Api.Domain.Entities;

public class Amenity
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? IconUrl { get; set; }
    public required string Category { get; set; }
    public string? Description { get; set; }
    public ICollection<HomestayAmenity> HomestayAmenities { get; set; } = [];
    public ICollection<RoomTypeAmenity> RoomTypeAmenities { get; set; } = [];
}

public class HomestayAmenity
{
    public long HomestayId { get; set; }
    public int AmenityId { get; set; }
    public Homestay Homestay { get; set; } = null!;
    public Amenity Amenity { get; set; } = null!;
}

public class RoomTypeAmenity
{
    public long RoomTypeId { get; set; }
    public int AmenityId { get; set; }
    public RoomType RoomType { get; set; } = null!;
    public Amenity Amenity { get; set; } = null!;
}
