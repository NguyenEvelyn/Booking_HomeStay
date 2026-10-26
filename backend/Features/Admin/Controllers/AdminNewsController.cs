using System.Security.Claims;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Admin.Audit;
using HomestayAuth.Api.Features.Admin.Authorization;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Features.News;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Admin.Controllers;

public sealed record NewsPostRequest(string Title, string? Slug, string Summary, string Content, string? CoverImageUrl, string Category,
    string Status, bool IsFeatured, DateTime? PublishedAt);
public sealed record NewsStatusRequest(string Status);

// Admin/Support write and publish news posts; newsletter subscribers are listed here too.
[ApiController, Route("api/admin/news"), Authorize(Policy = AdminPolicies.Access)]
public sealed class AdminNewsController(AppDbContext db, IAuditLogService audit, SupabaseStorageService storage) : ControllerBase
{
    private long UserId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? category, [FromQuery] string? search)
    {
        var query = db.NewsPosts.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(x => x.Category == category);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => EF.Functions.ILike(x.Title, $"%{search.Trim()}%"));
        var items = await query.OrderByDescending(x => x.UpdatedAt).Take(200)
            .Select(x => new { x.Id, x.Slug, x.Title, x.Summary, x.Content, x.CoverImageUrl, x.Category, x.Status, x.IsFeatured, x.PublishedAt,
                x.ViewCount, x.UpdatedAt, authorName = db.Users.Where(u => u.Id == x.AuthorId).Select(u => u.FullName).FirstOrDefault() })
            .ToListAsync();
        return Ok(new { items });
    }

    [HttpPost("cover"), RequestSizeLimit(ImageUpload.MaxBytes)]
    public async Task<IActionResult> UploadCover(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length == 0 || file.Length > ImageUpload.MaxBytes) return BadRequest(new { message = "Ảnh phải nhỏ hơn 8 MB." });
        if (await ImageUpload.Validate(file, cancellationToken) is not (var extension, var contentType))
            return BadRequest(new { message = "Chỉ hỗ trợ JPG, PNG hoặc WEBP hợp lệ." });
        await using var stream = file.OpenReadStream();
        var url = await storage.UploadPublicImageAsync(stream, $"news/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{extension}", contentType, cancellationToken);
        return Ok(new { url });
    }

    [HttpPost]
    public async Task<IActionResult> Create(NewsPostRequest request)
    {
        if (await Problem(request, null) is { } error) return BadRequest(new { message = error });
        var now = DateTime.UtcNow;
        var post = new NewsPost { Slug = await UniqueSlug(request.Slug, request.Title, null), Title = request.Title.Trim(), Summary = request.Summary.Trim(),
            Content = request.Content.Trim(), CoverImageUrl = Cover(request.CoverImageUrl), Category = request.Category, Status = request.Status,
            IsFeatured = request.IsFeatured, PublishedAt = PublishTime(request, null, now), AuthorId = UserId, CreatedAt = now, UpdatedAt = now };
        db.NewsPosts.Add(post);
        await db.SaveChangesAsync();
        audit.Add(HttpContext, "news.created", "news_post", post.Id, null, new { post.Title, post.Status, post.Category });
        await db.SaveChangesAsync();
        return Ok(new { post.Id, post.Slug, message = post.Status == NewsStatus.Published ? "Đã đăng bài viết." : "Đã lưu bài viết." });
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, NewsPostRequest request)
    {
        var post = await db.NewsPosts.SingleOrDefaultAsync(x => x.Id == id);
        if (post is null) return NotFound(new { message = "Không tìm thấy bài viết." });
        if (await Problem(request, id) is { } error) return BadRequest(new { message = error });
        var before = new { post.Title, post.Status, post.Slug };
        var now = DateTime.UtcNow;
        post.Slug = await UniqueSlug(request.Slug, request.Title, id); post.Title = request.Title.Trim(); post.Summary = request.Summary.Trim();
        post.Content = request.Content.Trim(); post.CoverImageUrl = Cover(request.CoverImageUrl); post.Category = request.Category;
        post.PublishedAt = PublishTime(request, post.PublishedAt, now); post.Status = request.Status; post.IsFeatured = request.IsFeatured; post.UpdatedAt = now;
        audit.Add(HttpContext, "news.updated", "news_post", id, before, new { post.Title, post.Status, post.Slug });
        await db.SaveChangesAsync();
        return Ok(new { post.Id, post.Slug, message = "Đã cập nhật bài viết." });
    }

    [HttpPatch("{id:long}/status")]
    public async Task<IActionResult> SetStatus(long id, NewsStatusRequest request)
    {
        if (!NewsRules.Statuses.Contains(request.Status)) return BadRequest(new { message = "Trạng thái không hợp lệ." });
        var post = await db.NewsPosts.SingleOrDefaultAsync(x => x.Id == id);
        if (post is null) return NotFound(new { message = "Không tìm thấy bài viết." });
        var before = post.Status;
        post.Status = request.Status; post.PublishedAt ??= request.Status == NewsStatus.Published ? DateTime.UtcNow : null; post.UpdatedAt = DateTime.UtcNow;
        audit.Add(HttpContext, "news.status", "news_post", id, before, post.Status);
        await db.SaveChangesAsync();
        return Ok(new { message = request.Status switch { NewsStatus.Published => "Bài viết đã hiển thị.", NewsStatus.Hidden => "Đã ẩn bài viết.", _ => "Đã chuyển về bản nháp." } });
    }

    [HttpDelete("{id:long}"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> Delete(long id)
    {
        var post = await db.NewsPosts.SingleOrDefaultAsync(x => x.Id == id);
        if (post is null) return NotFound(new { message = "Không tìm thấy bài viết." });
        db.NewsPosts.Remove(post);
        audit.Add(HttpContext, "news.deleted", "news_post", id, new { post.Title }, null);
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã xóa bài viết." });
    }

    [HttpGet("subscribers")]
    public async Task<IActionResult> Subscribers()
    {
        var items = await db.NewsletterSubscribers.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(5000)
            .Select(x => new { x.Id, x.Email, x.Status, x.Source, x.CreatedAt, x.UnsubscribedAt }).ToListAsync();
        return Ok(new { items, active = items.Count(x => x.Status == "Active") });
    }

    private async Task<string?> Problem(NewsPostRequest request, long? id)
    {
        if (NewsRules.Validate(request.Title, request.Summary, request.Content, request.Category, request.Status) is { } error) return error;
        if (!string.IsNullOrWhiteSpace(request.CoverImageUrl) && !ImageUpload.IsAllowedUrl(request.CoverImageUrl)) return "Ảnh bìa phải là đường dẫn https hợp lệ.";
        if (!string.IsNullOrWhiteSpace(request.Slug) && NewsRules.Slugify(request.Slug).Length == 0) return "Đường dẫn bài viết không hợp lệ.";
        if (request.IsFeatured && request.Status == NewsStatus.Published
            && await db.NewsPosts.CountAsync(x => x.IsFeatured && x.Status == NewsStatus.Published && x.Id != id) >= 3)
            return "Chỉ được tối đa 3 bài nổi bật đang hiển thị.";
        return null;
    }

    private static string? Cover(string? url) => string.IsNullOrWhiteSpace(url) ? null : url.Trim();

    // Publishing keeps an existing publish time unless the admin picks one; a draft has none until published.
    private static DateTime? PublishTime(NewsPostRequest request, DateTime? current, DateTime now) =>
        request.PublishedAt?.ToUniversalTime() ?? current ?? (request.Status == NewsStatus.Published ? now : null);

    private async Task<string> UniqueSlug(string? requested, string title, long? id)
    {
        var baseSlug = NewsRules.Slugify(string.IsNullOrWhiteSpace(requested) ? title : requested);
        if (baseSlug.Length == 0) baseSlug = "bai-viet";
        var slug = baseSlug;
        for (var n = 2; await db.NewsPosts.AnyAsync(x => x.Slug == slug && x.Id != id); n++) slug = $"{baseSlug}-{n}";
        return slug;
    }
}
