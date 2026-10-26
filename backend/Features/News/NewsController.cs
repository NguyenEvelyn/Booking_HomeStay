using System.Security.Cryptography;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.News;

// Public news: only posts that NewsRules.IsPublic allows (published and due).
[ApiController, Route("api/news"), AllowAnonymous]
public sealed class NewsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? category, [FromQuery] int page = 1, [FromQuery] int pageSize = 9)
    {
        var now = DateTime.UtcNow;
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 24);
        var query = db.NewsPosts.AsNoTracking().Where(x => x.Status == NewsStatus.Published && x.PublishedAt != null && x.PublishedAt <= now);
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(x => x.Category == category);
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(x => x.IsFeatured).ThenByDescending(x => x.PublishedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new { x.Id, x.Slug, x.Title, x.Summary, x.CoverImageUrl, x.Category, x.IsFeatured, x.PublishedAt, x.ViewCount })
            .ToListAsync();
        return Ok(new { items, total, page, pageSize });
    }

    [HttpGet("{slug}")]
    public async Task<IActionResult> Detail(string slug)
    {
        var now = DateTime.UtcNow;
        var post = await db.NewsPosts.SingleOrDefaultAsync(x => x.Slug == slug && x.Status == NewsStatus.Published && x.PublishedAt != null && x.PublishedAt <= now);
        if (post is null) return NotFound(new { message = "Không tìm thấy bài viết." });
        await db.NewsPosts.Where(x => x.Id == post.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.ViewCount, x => x.ViewCount + 1));
        var related = await db.NewsPosts.AsNoTracking()
            .Where(x => x.Id != post.Id && x.Category == post.Category && x.Status == NewsStatus.Published && x.PublishedAt != null && x.PublishedAt <= now)
            .OrderByDescending(x => x.PublishedAt).Take(3)
            .Select(x => new { x.Id, x.Slug, x.Title, x.Summary, x.CoverImageUrl, x.Category, x.PublishedAt }).ToListAsync();
        return Ok(new { post.Id, post.Slug, post.Title, post.Summary, post.Content, post.CoverImageUrl, post.Category, post.IsFeatured,
            post.PublishedAt, viewCount = post.ViewCount + 1, related });
    }
}

public sealed record NewsletterRequest(string? Email, string? Source);
public sealed record UnsubscribeRequest(string? Token);

// "Đăng ký nhận thông tin": stores the email only (no newsletter is sent yet).
[ApiController, Route("api/newsletter"), AllowAnonymous]
public sealed class NewsletterController(AppDbContext db) : ControllerBase
{
    // Same answer whether the email was new or already there, so the form cannot be used to probe addresses.
    private const string Thanks = "Cảm ơn bạn đã đăng ký! Tripio sẽ gửi ưu đãi và cẩm nang du lịch mới nhất qua email.";

    [EnableRateLimiting("newsletter"), HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe(NewsletterRequest request)
    {
        var email = NewsRules.NormalizeEmail(request.Email);
        if (email is null) return BadRequest(new { message = "Email không hợp lệ." });
        var source = request.Source is "home" or "footer" ? request.Source : "home";
        var existing = await db.NewsletterSubscribers.SingleOrDefaultAsync(x => x.Email == email);
        if (existing is null)
            db.NewsletterSubscribers.Add(new NewsletterSubscriber { Email = email, Source = source, Status = "Active",
                UnsubscribeToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant(), CreatedAt = DateTime.UtcNow });
        else if (existing.Status != "Active") { existing.Status = "Active"; existing.UnsubscribedAt = null; }
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException) { /* the same email was submitted twice at once: the other request stored it */ }
        return Ok(new { message = Thanks });
    }

    [HttpPost("unsubscribe")]
    public async Task<IActionResult> Unsubscribe(UnsubscribeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token)) return BadRequest(new { message = "Liên kết hủy đăng ký không hợp lệ." });
        await db.NewsletterSubscribers.Where(x => x.UnsubscribeToken == request.Token && x.Status == "Active")
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "Unsubscribed").SetProperty(x => x.UnsubscribedAt, DateTime.UtcNow));
        return Ok(new { message = "Bạn đã hủy đăng ký nhận tin từ Tripio." });
    }
}
