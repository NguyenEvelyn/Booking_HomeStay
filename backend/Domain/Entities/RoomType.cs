namespace HomestayAuth.Api.Domain.Entities;

public class RoomType
{
    public long Id { get; set; }
    public long HomestayId { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
    public decimal BasePrice { get; set; }
    public int MaxAdults { get; set; }
    public int MaxChildren { get; set; }
    public required string BedType { get; set; }
    public decimal? RoomSize { get; set; }
    public required string Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Homestay Homestay { get; set; } = null!;
    public ICollection<Room> Rooms { get; set; } = [];
    public ICollection<RoomTypeImage> Images { get; set; } = [];
    public ICollection<RoomTypeAmenity> RoomTypeAmenities { get; set; } = [];
    public ICollection<RoomPricePeriod> PricePeriods { get; set; } = [];
}

public class RoomPricePeriod
{
    public long Id { get; set; }
    public long RoomTypeId { get; set; }
    public required string Name { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal PricePerNight { get; set; }
    public DateTime CreatedAt { get; set; }
    public RoomType RoomType { get; set; } = null!;
}
