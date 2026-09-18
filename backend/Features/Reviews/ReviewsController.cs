using System.Security.Claims;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Reviews;

public sealed record CreateReviewRequest(long BookingId, int Rating, string? Comment);
public sealed record ReplyReviewRequest(string Reply);

[ApiController]
[Route("api")]
public sealed class ReviewsController(AppDbContext db) : ControllerBase
{
    [Authorize(Roles = "Host")]
    [HttpGet("host/reviews")]
    public async Task<IActionResult> GetForHost()
    {
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var items = await db.Reviews.AsNoTracking()
            .Where(x => db.Homestays.Any(h => h.Id == x.HomestayId && h.HostId == hostId))
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.HomestayId, HomestayName = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.Name).First(), x.Rating, x.Comment, x.HostReply, x.HostRepliedAt, x.CreatedAt, CustomerName = db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.FullName).First() })
            .ToListAsync();
        return Ok(new { items });
    }

    [AllowAnonymous]
    [HttpGet("homestays/{homestayId:long}/reviews")]
    public async Task<IActionResult> GetForHomestay(long homestayId)
    {
        var query = db.Reviews.AsNoTracking().Where(x => x.HomestayId == homestayId && x.Status == "Visible");
        var total = await query.CountAsync();
        var average = total == 0 ? 0 : await query.AverageAsync(x => x.Rating);
        var distribution = await query.GroupBy(x => x.Rating).Select(x => new { rating = x.Key, count = x.Count() }).ToListAsync();
        var items = await query.OrderByDescending(x => x.CreatedAt).Select(x => new {
            x.Id, x.Rating, x.Comment, x.HostReply, x.HostRepliedAt, x.CreatedAt,
            CustomerName = db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.FullName).First()
        }).ToListAsync();
        return Ok(new { average, total, distribution, items });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPost("reviews")]
    public async Task<IActionResult> Create(CreateReviewRequest request)
    {
        if (request.Rating is < 1 or > 5) return BadRequest(new { message = "Điểm đánh giá phải từ 1 đến 5." });
        if ((request.Comment?.Trim().Length ?? 0) > 1000) return BadRequest(new { message = "Nội dung đánh giá tối đa 1000 ký tự." });
        var customerId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var booking = await db.Bookings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.BookingId && x.CustomerId == customerId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        if (booking.Status != "Completed") return BadRequest(new { message = "Bạn chỉ có thể đánh giá sau khi kỳ lưu trú đã hoàn tất." });
        if (await db.Reviews.AnyAsync(x => x.BookingId == booking.Id)) return Conflict(new { message = "Đơn đặt phòng này đã được đánh giá." });
        var now = DateTime.UtcNow;
        var review = new Review { BookingId = booking.Id, CustomerId = customerId, HomestayId = booking.HomestayId, Rating = request.Rating, Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim(), Status = "Visible", CreatedAt = now, UpdatedAt = now };
        db.Reviews.Add(review); await db.SaveChangesAsync();
        return Created($"/api/homestays/{booking.HomestayId}/reviews", new { review.Id, message = "Đã gửi đánh giá." });
    }

    [Authorize(Roles = "Host")]
    [HttpPost("reviews/{reviewId:long}/reply")]
    public async Task<IActionResult> Reply(long reviewId, ReplyReviewRequest request)
    {
        var reply = request.Reply?.Trim();
        if (string.IsNullOrWhiteSpace(reply) || reply.Length > 1000) return BadRequest(new { message = "Phản hồi phải có nội dung và tối đa 1000 ký tự." });
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var review = await db.Reviews.SingleOrDefaultAsync(x => x.Id == reviewId && db.Homestays.Any(h => h.Id == x.HomestayId && h.HostId == hostId));
        if (review is null) return NotFound(new { message = "Không tìm thấy đánh giá thuộc homestay của bạn." });
        review.HostReply = reply; review.HostRepliedAt = DateTime.UtcNow; review.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); return Ok(new { message = "Đã phản hồi đánh giá." });
    }
}
