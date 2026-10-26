namespace HomestayAuth.Api.Domain.Entities;

// News / travel guide article managed by admins. Content is plain text (blank line = new paragraph,
// "## " = sub-heading) and is never rendered as HTML.
public class NewsPost
{
    public long Id { get; set; }
    public required string Slug { get; set; }
    public required string Title { get; set; }
    public required string Summary { get; set; }
    public required string Content { get; set; }
    public string? CoverImageUrl { get; set; }
    public string Category { get; set; } = NewsCategory.Guide;
    public string Status { get; set; } = NewsStatus.Draft;
    public bool IsFeatured { get; set; }
    public DateTime? PublishedAt { get; set; }
    public long? AuthorId { get; set; }
    public int ViewCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public static class NewsStatus
{
    public const string Draft = "Draft";
    public const string Published = "Published";
    public const string Hidden = "Hidden";
}

public static class NewsCategory
{
    public const string Guide = "CamNang";
    public const string Destination = "DiemDen";
    public const string Offer = "UuDai";
    public const string Tripio = "TinTripio";
}

// Email collected by the "Đăng ký nhận thông tin" form. No newsletter is sent yet.
public class NewsletterSubscriber
{
    public long Id { get; set; }
    public required string Email { get; set; }
    public string Status { get; set; } = "Active";
    public string Source { get; set; } = "home";
    public required string UnsubscribeToken { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UnsubscribedAt { get; set; }
}
