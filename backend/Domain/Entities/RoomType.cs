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
    public int BaseCapacity { get; set; }
    public int MaxCapacity { get; set; }
    public bool ExtraGuestAllowed { get; set; }
    public decimal ExtraGuestFee { get; set; }
    // Fixed fee per night for each child from 1.2 m staying beyond BaseCapacity (see OccupancyRules).
    public decimal ExtraChildFee { get; set; }
    public int ChildMaxAge { get; set; } = 11;
    // Children (from 1.2 m beyond capacity, plus any under 1.2 m) a room may take on top of BaseCapacity.
    public int MaxExtraChildren { get; set; } = 2;
    public decimal DepositPercent { get; set; } = .3m;
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
