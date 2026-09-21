using System.Security.Claims;
using HomestayAuth.Api.Features.Admin.Audit;
using HomestayAuth.Api.Features.Admin.Authorization;
using HomestayAuth.Api.Features.Auth.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Admin;

public sealed record AdminDecisionRequest(string? Reason);
public sealed record AdminFeaturedRequest(bool IsFeatured);

[ApiController, Route("api/admin"), Authorize(Policy = AdminPolicies.Access)]
public sealed class AdminController(AppDbContext db, IAuditLogService audit, IAuthService authService) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<IActionResult> Overview() => Ok(new {
        users = await db.Users.CountAsync(), hosts = await db.Users.CountAsync(u => u.Role == "Host"),
        homestays = await db.Homestays.CountAsync(), pendingHomestays = await db.Homestays.CountAsync(h => h.Status == "Pending"),
        bookings = await db.Bookings.CountAsync(), revenue = await db.Payments.Where(p => p.Status == "Success" && p.TransactionType == "Payment").SumAsync(p => (decimal?)p.Amount) ?? 0
    });

    [HttpGet("homestays")]
    public async Task<IActionResult> Homestays([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, [FromQuery] string? status = null, [FromQuery] string? city = null,
        [FromQuery] long? hostId = null, [FromQuery] int? minRating = null, [FromQuery] string sort = "updatedAt_desc")
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 100);
        var query = db.Homestays.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search)) { var term = search.Trim(); query = query.Where(h => EF.Functions.ILike(h.Name, $"%{term}%") || EF.Functions.ILike(h.Province, $"%{term}%")); }
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(h => h.Status == status);
        if (!string.IsNullOrWhiteSpace(city)) query = query.Where(h => h.Province == city);
        if (hostId.HasValue) query = query.Where(h => h.HostId == hostId);
        if (minRating is > 0) query = query.Where(h => db.Reviews.Where(r => r.HomestayId == h.Id && r.Status == "Visible").Average(r => (double?)r.Rating) >= minRating);
        query = sort switch { "name_asc" => query.OrderBy(h => h.Name), "rating_desc" => query.OrderByDescending(h => db.Reviews.Where(r => r.HomestayId == h.Id && r.Status == "Visible").Average(r => (double?)r.Rating) ?? 0), "createdAt_desc" => query.OrderByDescending(h => h.CreatedAt), _ => query.OrderBy(h => h.Status == "Pending" ? 0 : 1).ThenByDescending(h => h.UpdatedAt) };
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(h => new { h.Id, h.Name, h.AddressLine, h.District, h.Province, h.Status, h.IsFeatured, h.RejectionReason, h.ReviewedAt, h.HostId, HostName = db.Users.Where(u => u.Id == h.HostId).Select(u => u.FullName).First(), RoomTypeCount = h.RoomTypes.Count(), MinPrice = h.RoomTypes.Select(r => (decimal?)r.BasePrice).Min(), AverageRating = db.Reviews.Where(r => r.HomestayId == h.Id && r.Status == "Visible").Average(r => (double?)r.Rating), ReviewCount = db.Reviews.Count(r => r.HomestayId == h.Id && r.Status == "Visible"), h.UpdatedAt }).ToListAsync();
        return Ok(new { items, page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [HttpGet("homestays/filters")]
    public async Task<IActionResult> HomestayFilters() => Ok(new
    {
        cities = await db.Homestays.AsNoTracking().Select(x => x.Province).Distinct().OrderBy(x => x).ToListAsync(),
        hosts = await db.Users.AsNoTracking().Where(x => x.Role == "Host").OrderBy(x => x.FullName).Select(x => new { x.Id, x.FullName }).ToListAsync()
    });

    [HttpGet("homestays/{id:long}")]
    public async Task<IActionResult> HomestayDetail(long id)
    {
        var item = await db.Homestays.AsNoTracking().Where(h => h.Id == id).Select(h => new
        {
            h.Id, h.Name, h.Description, h.AddressLine, h.Ward, h.District, h.Province, h.Status, h.IsFeatured, h.RejectionReason,
            h.HostId, HostName = db.Users.Where(u => u.Id == h.HostId).Select(u => u.FullName).First(), HostEmail = db.Users.Where(u => u.Id == h.HostId).Select(u => u.Email).First(),
            AverageRating = db.Reviews.Where(r => r.HomestayId == h.Id && r.Status == "Visible").Average(r => (double?)r.Rating), ReviewCount = db.Reviews.Count(r => r.HomestayId == h.Id && r.Status == "Visible"),
            ActiveBookingCount = db.Bookings.Count(b => b.HomestayId == h.Id && new[] { "Confirmed", "CheckedIn" }.Contains(b.Status)),
            Amenities = h.HomestayAmenities.Select(x => x.Amenity.Name).ToList(),
            Images = h.Images.OrderByDescending(x => x.IsThumbnail).ThenBy(x => x.SortOrder).Select(x => new { x.ImageUrl, x.Caption, x.IsThumbnail }).ToList(),
            RoomTypes = h.RoomTypes.Select(x => new { x.Id, x.Name, x.Description, x.BasePrice, x.MaxAdults, x.MaxChildren, x.Status, RoomCount = x.Rooms.Count() }).ToList()
        }).SingleOrDefaultAsync();
        return item is null ? NotFound(new { message = "Không tìm thấy homestay." }) : Ok(item);
    }

    [HttpPatch("homestays/{id:long}/{decision:regex(^(approve|reject|suspend|restore)$)}"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> DecideHomestay(long id, string decision, AdminDecisionRequest request)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var item = await db.Homestays.SingleOrDefaultAsync(h => h.Id == id);
        if (item is null) return NotFound(new { message = "Không tìm thấy homestay." });
        if (decision.Equals("approve", StringComparison.OrdinalIgnoreCase) && (!await db.HomestayImages.AnyAsync(x => x.HomestayId == id) || !await db.Rooms.AnyAsync(x => x.RoomType.HomestayId == id))) return BadRequest(new { message = "Không thể duyệt Homestay chưa có ảnh và phòng kinh doanh." });
        if ((decision.Equals("approve", StringComparison.OrdinalIgnoreCase) || decision.Equals("reject", StringComparison.OrdinalIgnoreCase)) && item.Status != "Pending") return BadRequest(new { message = "Admin chỉ duyệt hoặc từ chối Homestay mới đang chờ duyệt." });
        if (decision.Equals("suspend", StringComparison.OrdinalIgnoreCase) && item.Status != "Approved") return BadRequest(new { message = "Chỉ có thể tạm ngưng Homestay đang hoạt động." });
        if (decision.Equals("restore", StringComparison.OrdinalIgnoreCase) && item.Status != "Suspended") return BadRequest(new { message = "Chỉ có thể khôi phục Homestay đang bị ẩn." });
        var status = decision.ToLowerInvariant() switch { "approve" => "Approved", "reject" => "Rejected", "suspend" => "Suspended", "restore" => "Approved", _ => null };
        if (status is null) return BadRequest(new { message = "Thao tác không hợp lệ." });
        var reason = request.Reason?.Trim();
        if (status is "Rejected" or "Suspended" && string.IsNullOrWhiteSpace(reason)) return BadRequest(new { message = "Vui lòng nhập lý do thực hiện." });
        if ((reason?.Length ?? 0) > 500) return BadRequest(new { message = "Lý do tối đa 500 ký tự." });
        var before = new { item.Status, item.IsFeatured, item.RejectionReason, item.ReviewedBy, item.ReviewedAt };
        item.Status = status; if (status != "Approved") item.IsFeatured = false; item.RejectionReason = status is "Rejected" or "Suspended" ? reason : null; item.ReviewedBy = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!); item.ReviewedAt = DateTime.UtcNow; item.UpdatedAt = DateTime.UtcNow;
        audit.Add(HttpContext, $"homestay.{decision.ToLowerInvariant()}", "homestay", id, before, new { item.Status, item.IsFeatured, item.RejectionReason, item.ReviewedBy, item.ReviewedAt }, reason);
        await db.SaveChangesAsync(); await transaction.CommitAsync();
        return Ok(new { message = decision.Equals("restore", StringComparison.OrdinalIgnoreCase) ? "Đã khôi phục homestay." : status == "Approved" ? "Đã duyệt homestay." : status == "Rejected" ? "Đã từ chối homestay." : "Đã ẩn homestay." });
    }

    [HttpPatch("homestays/{id:long}/featured"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> SetFeatured(long id, AdminFeaturedRequest request)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var item = await db.Homestays.SingleOrDefaultAsync(x => x.Id == id);
        if (item is null) return NotFound(new { message = "Không tìm thấy homestay." });
        if (request.IsFeatured && item.Status != "Approved") return BadRequest(new { message = "Chỉ Homestay đang hoạt động mới có thể đặt Nổi bật." });
        var before = new { item.IsFeatured };
        item.IsFeatured = request.IsFeatured; item.UpdatedAt = DateTime.UtcNow;
        audit.Add(HttpContext, request.IsFeatured ? "homestay.feature" : "homestay.unfeature", "homestay", id, before, new { item.IsFeatured });
        await db.SaveChangesAsync(); await transaction.CommitAsync();
        return Ok(new { message = request.IsFeatured ? "Đã đặt Homestay là Nổi bật." : "Đã bỏ nhãn Nổi bật." });
    }

    [HttpGet("users")]
    public async Task<IActionResult> Users([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, [FromQuery] string? role = null, [FromQuery] string? status = null, [FromQuery] string sort = "createdAt_desc")
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 100);
        var query = db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search)) { var term = search.Trim(); query = query.Where(u => EF.Functions.ILike(u.FullName, $"%{term}%") || EF.Functions.ILike(u.Email, $"%{term}%")); }
        if (!string.IsNullOrWhiteSpace(role)) query = query.Where(u => u.Role == role);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(u => u.Status == status);
        query = sort switch { "name_asc" => query.OrderBy(u => u.FullName), "createdAt_asc" => query.OrderBy(u => u.CreatedAt), _ => query.OrderByDescending(u => u.CreatedAt) };
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(u => new
        {
            u.Id, u.FullName, u.Email, u.PhoneNumber, u.Role, u.Status, u.CreatedAt,
            RelatedCount = u.Role == "Host" ? db.Homestays.Count(h => h.HostId == u.Id) : db.Bookings.Count(b => b.CustomerId == u.Id)
        }).ToListAsync();
        return Ok(new { items, page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [HttpGet("users/{id:long}")]
    public async Task<IActionResult> UserDetail(long id, [FromQuery] int historyPage = 1, [FromQuery] int pageSize = 10)
    {
        historyPage = Math.Max(1, historyPage); pageSize = Math.Clamp(pageSize, 5, 50);
        var user = await db.Users.AsNoTracking().Where(x => x.Id == id).Select(x => new
        {
            x.Id, x.FullName, x.Email, x.PhoneNumber, x.AvatarUrl, x.Bio, x.Address, x.Role, x.Status,
            x.EmailVerifiedAt, x.CreatedAt, x.UpdatedAt
        }).SingleOrDefaultAsync();
        if (user is null) return NotFound(new { message = "Không tìm thấy tài khoản." });
        if (user.Role == "Host")
        {
            var query = db.Homestays.AsNoTracking().Where(x => x.HostId == id).OrderByDescending(x => x.CreatedAt);
            var total = await query.CountAsync();
            var items = await query.Skip((historyPage - 1) * pageSize).Take(pageSize)
                .Select(x => new { x.Id, x.Name, x.Province, x.Status, x.CreatedAt, bookings = db.Bookings.Count(b => b.HomestayId == x.Id) }).ToListAsync();
            return Ok(new { user, history = new { type = "homestays", items, page = historyPage, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) } });
        }
        else
        {
            var query = db.Bookings.AsNoTracking().Where(x => x.CustomerId == id).OrderByDescending(x => x.CreatedAt);
            var total = await query.CountAsync();
            var items = await query.Skip((historyPage - 1) * pageSize).Take(pageSize)
                .Select(x => new { x.Id, x.BookingCode, HomestayName = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.Name).First(), x.CheckInDate, x.CheckOutDate, x.TotalAmount, x.Status, x.CreatedAt }).ToListAsync();
            return Ok(new { user, history = new { type = "bookings", items, page = historyPage, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) } });
        }
    }

    [HttpPatch("users/{id:long}/status"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> SetUserStatus(long id, AdminDecisionRequest request)
    {
        var adminId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (id == adminId) return BadRequest(new { message = "Bạn không thể khóa tài khoản đang đăng nhập." });
        await using var transaction = await db.Database.BeginTransactionAsync();
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound(new { message = "Không tìm thấy tài khoản." });
        var locking = user.Status == "Active"; var reason = request.Reason?.Trim();
        if (locking && string.IsNullOrWhiteSpace(reason)) return BadRequest(new { message = "Vui lòng nhập lý do khóa tài khoản." });
        if (locking && user.Role == "Admin" && await db.Users.CountAsync(x => x.Role == "Admin" && x.Status == "Active") <= 1)
            return BadRequest(new { message = "Không thể khóa quản trị viên đang hoạt động cuối cùng." });
        if ((reason?.Length ?? 0) > 500) return BadRequest(new { message = "Lý do tối đa 500 ký tự." });
        var before = new { user.Status, user.AuthVersion };
        user.Status = locking ? "Locked" : "Active"; user.AuthVersion++; user.UpdatedAt = DateTime.UtcNow;
        audit.Add(HttpContext, locking ? "user.lock" : "user.unlock", "user", id, before, new { user.Status, user.AuthVersion }, reason);
        await db.SaveChangesAsync(); await transaction.CommitAsync();
        return Ok(new { message = user.Status == "Active" ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản." });
    }

    [HttpPost("users/{id:long}/password-reset"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> RequestPasswordReset(long id, AdminDecisionRequest request)
    {
        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 500)
            return BadRequest(new { message = "Vui lòng nhập lý do đặt lại mật khẩu, tối đa 500 ký tự." });
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id);
        if (user is null) return NotFound(new { message = "Không tìm thấy tài khoản." });
        if (user.Status != "Active") return BadRequest(new { message = "Chỉ có thể gửi yêu cầu đặt lại mật khẩu cho tài khoản đang hoạt động." });
        await using var transaction = await db.Database.BeginTransactionAsync();
        try { await authService.RequestPasswordResetAsync(user.Email); }
        catch (InvalidOperationException error) { return StatusCode(503, new { message = error.Message }); }
        audit.Add(HttpContext, "user.password_reset_requested", "user", id,
            new { resetRequested = false }, new { resetRequested = true, expiresInMinutes = 10 }, reason);
        await db.SaveChangesAsync(); await transaction.CommitAsync();
        return Ok(new { message = "Đã gửi mã OTP đặt lại mật khẩu đến email của người dùng." });
    }
}
