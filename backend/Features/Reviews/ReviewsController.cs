using HomestayAuth.Api.Features.Notifications;
using System.Security.Claims;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Bookings;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Reviews;

public sealed record CreateReviewRequest(long BookingId, int Rating, string? Comment, int? CleanlinessRating = null, int? LocationRating = null, int? HostRating = null, int? ValueRating = null);
public sealed record ReplyReviewRequest(string Reply);
public sealed record ReportReviewRequest(string Reason, string? Detail);
public sealed record SaveCustomerNoteRequest(string? Note);

[ApiController]
[Route("api")]
public sealed class ReviewsController(AppDbContext db, NotificationService notifications) : ControllerBase
{
    private long UserId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private IQueryable<Review> HostReviews(long hostId) => db.Reviews.Where(x => db.Homestays.Any(h => h.Id == x.HomestayId && h.HostId == hostId));
    private static bool ValidCriteria(CreateReviewRequest request) => new[] { request.CleanlinessRating, request.LocationRating, request.HostRating, request.ValueRating }.All(x => x is null or >= 1 and <= 5);

    [Authorize(Roles = "Host")]
    [HttpGet("host/reviews")]
    public async Task<IActionResult> GetForHost([FromQuery] long? homestayId, [FromQuery] int? rating, [FromQuery] string? reply,
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? search, [FromQuery] string sort = "newest",
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 50);
        var query = HostReviews(UserId).AsNoTracking();
        if (homestayId.HasValue) query = query.Where(x => x.HomestayId == homestayId);
        if (rating.HasValue) query = query.Where(x => x.Rating == rating);
        if (reply == "pending") query = query.Where(x => x.HostReply == null || x.HostReply == "");
        if (reply == "replied") query = query.Where(x => x.HostReply != null && x.HostReply != "");
        if (from.HasValue) { var start = from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc); query = query.Where(x => x.CreatedAt >= start); }
        if (to.HasValue) { var end = to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc); query = query.Where(x => x.CreatedAt < end); }
        if (!string.IsNullOrWhiteSpace(search)) { var term = search.Trim().ToLower(); query = query.Where(x => (x.Comment != null && x.Comment.ToLower().Contains(term)) || db.Users.Any(u => u.Id == x.CustomerId && u.FullName.ToLower().Contains(term))); }
        query = sort switch { "rating-low" => query.OrderBy(x => x.Rating).ThenByDescending(x => x.CreatedAt), "needs-reply" => query.OrderBy(x => x.HostReply != null).ThenBy(x => x.Rating).ThenByDescending(x => x.CreatedAt), _ => query.OrderByDescending(x => x.CreatedAt) };
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(x => new {
            x.Id, x.BookingId, BookingCode = db.Bookings.Where(b => b.Id == x.BookingId).Select(b => b.BookingCode).First(),
            x.HomestayId, HomestayName = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.Name).First(),
            RoomNames = db.BookingDetails.Where(d => d.BookingId == x.BookingId).Select(d => d.RoomId == null
                ? db.RoomTypes.Where(t => t.Id == d.RoomTypeId).Select(t => t.Name).First()
                : db.Rooms.Where(r => r.Id == d.RoomId).Select(r => r.RoomNumber).First()).ToList(),
            x.CustomerId, CustomerName = db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.FullName).First(),
            CustomerAvatar = db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.AvatarUrl).FirstOrDefault(),
            x.Rating, x.Comment, x.HostReply, x.HostRepliedAt, x.Status, x.CreatedAt,
            IsReported = db.ReviewReports.Any(r => r.ReviewId == x.Id && r.HostId == UserId)
        }).ToListAsync();
        return Ok(new { items, total, page, pageSize, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [Authorize(Roles = "Host")]
    [HttpGet("host/reviews/summary")]
    public async Task<IActionResult> Summary([FromQuery] long? homestayId, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var query = HostReviews(UserId).AsNoTracking().Where(x => x.Status == "Visible");
        if (homestayId.HasValue) query = query.Where(x => x.HomestayId == homestayId);
        if (from.HasValue) { var start = from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc); query = query.Where(x => x.CreatedAt >= start); }
        if (to.HasValue) { var end = to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc); query = query.Where(x => x.CreatedAt < end); }
        var total = await query.CountAsync(); var replied = await query.CountAsync(x => x.HostReply != null && x.HostReply != "");
        var distribution = await query.GroupBy(x => x.Rating).Select(g => new { rating = g.Key, count = g.Count() }).ToListAsync();
        return Ok(new { average = total == 0 ? 0 : await query.AverageAsync(x => x.Rating), total, distribution, pendingReply = total - replied, responseRate = total == 0 ? 0 : Math.Round(replied * 100d / total, 1) });
    }

    [AllowAnonymous]
    [HttpGet("homestays/{homestayId:long}/reviews")]
    public async Task<IActionResult> GetForHomestay(long homestayId)
    {
        var query = db.Reviews.AsNoTracking().Where(x => x.HomestayId == homestayId && x.Status == "Visible");
        var total = await query.CountAsync(); var distribution = await query.GroupBy(x => x.Rating).Select(x => new { rating = x.Key, count = x.Count() }).ToListAsync();
        var items = await query.OrderByDescending(x => x.CreatedAt).Select(x => new { x.Id, x.Rating, x.Comment, x.HostReply, x.HostRepliedAt, x.CreatedAt, CustomerName = db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.FullName).First() }).ToListAsync();
        return Ok(new { average = total == 0 ? 0 : await query.AverageAsync(x => x.Rating), total, distribution, items });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPost("reviews")]
    public async Task<IActionResult> Create(CreateReviewRequest request)
    {
        if (request.Rating is < 1 or > 5) return BadRequest(new { message = "Điểm đánh giá phải từ 1 đến 5." });
        if ((request.Comment?.Trim().Length ?? 0) > 1000) return BadRequest(new { message = "Nội dung đánh giá tối đa 1000 ký tự." });
        if (!ValidCriteria(request)) return BadRequest(new { message = "Điểm tiêu chí phải từ 1 đến 5." });
        var booking = await db.Bookings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.BookingId && x.CustomerId == UserId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        if (await db.Homestays.AnyAsync(h => h.Id == booking.HomestayId && h.HostId == UserId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bạn không thể đánh giá homestay của chính mình." });
        if (booking.Status != BookingStatus.CheckedOut) return BadRequest(new { message = "Bạn chỉ có thể đánh giá sau khi kỳ lưu trú đã hoàn tất." });
        if (await db.Reviews.AnyAsync(x => x.BookingId == booking.Id)) return Conflict(new { message = "Đơn đặt phòng này đã được đánh giá." });
        if (BookingRules.Today > booking.ReviewCreateUntil) return BadRequest(new { message = "Thời hạn đánh giá sau khi trả phòng đã kết thúc." });
        var now = DateTime.UtcNow; var review = new Review { BookingId = booking.Id, CustomerId = UserId, HomestayId = booking.HomestayId, Rating = request.Rating, Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim(), CleanlinessRating = request.CleanlinessRating, LocationRating = request.LocationRating, HostRating = request.HostRating, ValueRating = request.ValueRating, Status = "Visible", CreatedAt = now, UpdatedAt = now };
        db.Reviews.Add(review);
        var homestayName = await db.Homestays.Where(h => h.Id == booking.HomestayId).Select(h => h.Name).SingleAsync();
        var reviewer = await db.Users.Where(u => u.Id == UserId).Select(u => u.FullName).SingleAsync();
        await notifications.NotifyHostOfHomestay(booking.HomestayId, NotificationTemplates.NewReview(homestayName, request.Rating, reviewer));
        await db.SaveChangesAsync(); return Created($"/api/homestays/{booking.HomestayId}/reviews", new { review.Id, message = "Đã gửi đánh giá." });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPut("reviews/{reviewId:long}")]
    public async Task<IActionResult> Update(long reviewId, CreateReviewRequest request)
    {
        if (request.Rating is < 1 or > 5 || !ValidCriteria(request)) return BadRequest(new { message = "Điểm đánh giá phải từ 1 đến 5." });
        if ((request.Comment?.Trim().Length ?? 0) > 1000) return BadRequest(new { message = "Nội dung đánh giá tối đa 1000 ký tự." });
        var review = await db.Reviews.SingleOrDefaultAsync(x => x.Id == reviewId && x.CustomerId == UserId);
        if (review is null) return NotFound(new { message = "Không tìm thấy đánh giá của bạn." });
        var reviewEditUntil = await db.Bookings.Where(b => b.Id == review.BookingId).Select(b => b.ReviewEditUntil).SingleAsync();
        if (BookingRules.Today > reviewEditUntil) return BadRequest(new { message = "Đã hết thời hạn sửa đánh giá." });
        review.Rating = request.Rating; review.Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
        review.CleanlinessRating = request.CleanlinessRating; review.LocationRating = request.LocationRating; review.HostRating = request.HostRating; review.ValueRating = request.ValueRating; review.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); return Ok(new { message = "Đã cập nhật đánh giá." });
    }

    [Authorize(Roles = "Host")]
    [HttpPost("reviews/{reviewId:long}/reply")]
    [HttpPut("host/reviews/{reviewId:long}/reply")]
    public async Task<IActionResult> Reply(long reviewId, ReplyReviewRequest request)
    {
        var reply = request.Reply?.Trim(); if (string.IsNullOrWhiteSpace(reply) || reply.Length > 500) return BadRequest(new { message = "Phản hồi phải có nội dung và tối đa 500 ký tự." });
        var review = await HostReviews(UserId).SingleOrDefaultAsync(x => x.Id == reviewId); if (review is null) return NotFound(new { message = "Không tìm thấy đánh giá thuộc homestay của bạn." });
        review.HostReply = reply; review.HostRepliedAt = DateTime.UtcNow; review.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync(); return Ok(new { message = "Đã lưu phản hồi." });
    }

    [Authorize(Roles = "Host")]
    [HttpDelete("host/reviews/{reviewId:long}/reply")]
    public async Task<IActionResult> DeleteReply(long reviewId)
    {
        var review = await HostReviews(UserId).SingleOrDefaultAsync(x => x.Id == reviewId); if (review is null) return NotFound(new { message = "Không tìm thấy đánh giá thuộc homestay của bạn." });
        review.HostReply = null; review.HostRepliedAt = null; review.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync(); return Ok(new { message = "Đã xóa phản hồi của Host." });
    }

    [Authorize(Roles = "Host")]
    [HttpPost("host/reviews/{reviewId:long}/report")]
    public async Task<IActionResult> Report(long reviewId, ReportReviewRequest request)
    {
        var reasons = new[] { "Spam", "Abusive", "FalseInformation", "Other" }; if (!reasons.Contains(request.Reason)) return BadRequest(new { message = "Lý do báo cáo không hợp lệ." });
        if (!await HostReviews(UserId).AnyAsync(x => x.Id == reviewId)) return NotFound(new { message = "Không tìm thấy đánh giá thuộc homestay của bạn." });
        var report = await db.ReviewReports.SingleOrDefaultAsync(x => x.ReviewId == reviewId && x.HostId == UserId); var now = DateTime.UtcNow;
        if (report is null) db.ReviewReports.Add(new ReviewReport { ReviewId = reviewId, HostId = UserId, Reason = request.Reason, Detail = request.Detail?.Trim(), Status = "Pending", CreatedAt = now, UpdatedAt = now });
        else { report.Reason = request.Reason; report.Detail = request.Detail?.Trim(); report.Status = "Pending"; report.UpdatedAt = now; }
        await db.SaveChangesAsync(); return Ok(new { message = "Đã gửi báo cáo để Admin xem xét." });
    }

    [Authorize(Roles = "Host")]
    [HttpGet("host/customers")]
    public async Task<IActionResult> Customers([FromQuery] string? search, [FromQuery] string sort = "bookings", [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 50); var hostId = UserId;
        var query = db.Users.AsNoTracking().Where(u => db.Bookings.Any(b => b.CustomerId == u.Id && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == hostId)));
        if (!string.IsNullOrWhiteSpace(search)) { var term = search.Trim().ToLower(); query = query.Where(u => u.FullName.ToLower().Contains(term) || u.Email.ToLower().Contains(term) || (u.PhoneNumber != null && u.PhoneNumber.Contains(term))); }
        var shaped = query.Select(u => new { u.Id, u.FullName, u.Email, u.PhoneNumber, u.AvatarUrl,
            BookingCount = db.Bookings.Count(b => b.CustomerId == u.Id && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == hostId)),
            CompletedCount = db.Bookings.Count(b => b.CustomerId == u.Id && b.Status == BookingStatus.CheckedOut && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == hostId)),
            TotalSpent = db.Bookings.Where(b => b.CustomerId == u.Id && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == hostId)).SelectMany(b => b.Payments).Where(p => p.TransactionType != "Refund" && p.Status == "Success").Sum(p => (decimal?)p.Amount) ?? 0,
            LastStay = db.Bookings.Where(b => b.CustomerId == u.Id && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == hostId)).Max(b => (DateOnly?)b.CheckOutDate),
            Note = db.HostCustomerNotes.Where(n => n.HostId == hostId && n.CustomerId == u.Id).Select(n => n.Note).FirstOrDefault() });
        shaped = sort == "spending" ? shaped.OrderByDescending(x => x.TotalSpent) : shaped.OrderByDescending(x => x.BookingCount);
        var total = await shaped.CountAsync(); var items = await shaped.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new { items, total, page, pageSize, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [Authorize(Roles = "Host")]
    [HttpGet("host/customers/{customerId:long}")]
    public async Task<IActionResult> CustomerDetail(long customerId)
    {
        var hostId = UserId; var customer = await db.Users.AsNoTracking().Where(u => u.Id == customerId && db.Bookings.Any(b => b.CustomerId == u.Id && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == hostId))).Select(u => new { u.Id, u.FullName, u.Email, u.PhoneNumber, u.AvatarUrl }).SingleOrDefaultAsync();
        if (customer is null) return NotFound(new { message = "Không tìm thấy khách hàng thuộc Homestay của bạn." });
        var bookings = await db.Bookings.AsNoTracking().Where(b => b.CustomerId == customerId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == hostId)).OrderByDescending(b => b.CreatedAt).Select(b => new { b.Id, b.BookingCode, HomestayName = db.Homestays.Where(h => h.Id == b.HomestayId).Select(h => h.Name).First(), b.CheckInDate, b.CheckOutDate, b.TotalAmount, b.Status }).ToListAsync();
        var reviews = await HostReviews(hostId).AsNoTracking().Where(r => r.CustomerId == customerId).OrderByDescending(r => r.CreatedAt).Select(r => new { r.Id, r.Rating, r.Comment, r.CreatedAt, HomestayName = db.Homestays.Where(h => h.Id == r.HomestayId).Select(h => h.Name).First() }).ToListAsync();
        var note = await db.HostCustomerNotes.AsNoTracking().Where(n => n.HostId == hostId && n.CustomerId == customerId).Select(n => n.Note).FirstOrDefaultAsync(); return Ok(new { customer, bookings, reviews, note });
    }

    [Authorize(Roles = "Host")]
    [HttpPut("host/customers/{customerId:long}/note")]
    public async Task<IActionResult> SaveNote(long customerId, SaveCustomerNoteRequest request)
    {
        if ((request.Note?.Length ?? 0) > 1000) return BadRequest(new { message = "Ghi chú tối đa 1000 ký tự." }); var hostId = UserId;
        if (!await db.Bookings.AnyAsync(b => b.CustomerId == customerId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == hostId))) return NotFound(new { message = "Không tìm thấy khách hàng thuộc Homestay của bạn." });
        var note = await db.HostCustomerNotes.SingleOrDefaultAsync(n => n.HostId == hostId && n.CustomerId == customerId); var now = DateTime.UtcNow;
        if (note is null) db.HostCustomerNotes.Add(new HostCustomerNote { HostId = hostId, CustomerId = customerId, Note = request.Note?.Trim(), CreatedAt = now, UpdatedAt = now }); else { note.Note = request.Note?.Trim(); note.UpdatedAt = now; }
        await db.SaveChangesAsync(); return Ok(new { message = "Đã lưu ghi chú nội bộ." });
    }
}
