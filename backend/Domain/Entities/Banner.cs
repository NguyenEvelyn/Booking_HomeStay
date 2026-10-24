namespace HomestayAuth.Api.Domain.Entities;

// Home page campaign banner. The link is a typed target (never a free URL) and is re-checked when served,
// so a banner disappears by itself when its deal sells out or its homestay is no longer listed.
public class Banner
{
    public long Id { get; set; }
    public required string Title { get; set; }
    public string? Subtitle { get; set; }
    public required string ImageUrl { get; set; }
    public string Placement { get; set; } = BannerPlacement.HomeHero;
    public required string TargetType { get; set; }
    public long? TargetId { get; set; }
    // Province for "Search" banners.
    public string? TargetQuery { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public int Priority { get; set; }
    public string Status { get; set; } = BannerStatus.Active;
    // Host who proposed the banner (deal promotion request); null for banners created by an admin.
    public long? RequestedBy { get; set; }
    public string? ReviewNote { get; set; }
    public long? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public static class BannerPlacement
{
    public const string HomeHero = "HomeHero";
    public const string HomeDeals = "HomeDeals";
}

public static class BannerTarget
{
    public const string Deal = "Deal";
    public const string Homestay = "Homestay";
    public const string Voucher = "Voucher";
    public const string Search = "Search";
}

public static class BannerStatus
{
    public const string Pending = "Pending";
    public const string Active = "Active";
    public const string Inactive = "Inactive";
    public const string Rejected = "Rejected";
}
