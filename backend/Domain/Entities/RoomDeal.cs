namespace HomestayAuth.Api.Domain.Entities;

// Last-minute deal: a limited number of rooms of one room type sold at a discount for nights in the next few days.
public class RoomDeal
{
    public long Id { get; set; }
    public long HomestayId { get; set; }
    public long RoomTypeId { get; set; }
    // Nights covered: [StartDate, EndDate).
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal DiscountPercent { get; set; }
    public int RoomsLimit { get; set; }
    public DateTime SaleEndsAt { get; set; }
    // When true a voucher can be applied on top of the deal price; otherwise the deal is the only discount.
    public bool AllowVoucher { get; set; }
    public string Status { get; set; } = RoomDealStatus.Active;
    // "Manual" or "NoShow" (created right after releasing a no-show room).
    public string Source { get; set; } = RoomDealSource.Manual;
    public long? SourceBookingId { get; set; }
    public long CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public RoomType RoomType { get; set; } = null!;
    public Homestay Homestay { get; set; } = null!;
}

public static class RoomDealStatus
{
    public const string Active = "Active";
    public const string Ended = "Ended";
}

public static class RoomDealSource
{
    public const string Manual = "Manual";
    public const string NoShow = "NoShow";
}
