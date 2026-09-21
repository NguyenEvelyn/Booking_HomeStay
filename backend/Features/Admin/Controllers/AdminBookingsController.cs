using System.Security.Claims;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Admin.Audit;
using HomestayAuth.Api.Features.Admin.Authorization;
using HomestayAuth.Api.Features.Bookings;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Admin.Controllers;

public sealed record AdminBookingDecision(string Reason, string? Status = null);

[ApiController, Route("api/admin/bookings"), Authorize(Policy = AdminPolicies.Access)]
public sealed class AdminBookingsController(AppDbContext db, IAuditLogService audit) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, [FromQuery] string? status = null, [FromQuery] long? homestayId = null,
        [FromQuery] long? hostId = null, [FromQuery] long? customerId = null, [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null, [FromQuery] string? paymentMethod = null, [FromQuery] string sort = "createdAt_desc")
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 100);
        var query = db.Bookings.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(b => EF.Functions.ILike(b.BookingCode, $"%{search.Trim()}%") ||
            db.Users.Any(u => u.Id == b.CustomerId && EF.Functions.ILike(u.FullName, $"%{search.Trim()}%")));
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(b => b.Status == status);
        if (homestayId.HasValue) query = query.Where(b => b.HomestayId == homestayId);
        if (hostId.HasValue) query = query.Where(b => db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == hostId));
        if (customerId.HasValue) query = query.Where(b => b.CustomerId == customerId);
        if (from.HasValue) query = query.Where(b => b.CheckInDate >= from);
        if (to.HasValue) query = query.Where(b => b.CheckInDate <= to);
        if (!string.IsNullOrWhiteSpace(paymentMethod)) query = query.Where(b => b.Payments.Any(p => p.PaymentMethod == paymentMethod));
        query = sort switch { "createdAt_asc" => query.OrderBy(b => b.CreatedAt), "checkIn_asc" => query.OrderBy(b => b.CheckInDate),
            "amount_desc" => query.OrderByDescending(b => b.TotalAmount), _ => query.OrderByDescending(b => b.CreatedAt) };
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(b => new
        {
            b.Id, b.BookingCode, b.CustomerId, CustomerName = db.Users.Where(u => u.Id == b.CustomerId).Select(u => u.FullName).First(),
            b.HomestayId, HomestayName = db.Homestays.Where(h => h.Id == b.HomestayId).Select(h => h.Name).First(),
            HostId = db.Homestays.Where(h => h.Id == b.HomestayId).Select(h => h.HostId).First(),
            b.CheckInDate, b.CheckOutDate, b.TotalAmount, b.Status, b.CreatedAt,
            PaymentMethod = b.Payments.OrderByDescending(p => p.CreatedAt).Select(p => p.PaymentMethod).FirstOrDefault()
        }).ToListAsync();
        return Ok(new { items, page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> Detail(long id)
    {
        var item = await db.Bookings.AsNoTracking().Where(b => b.Id == id).Select(b => new
        {
            b.Id, b.BookingCode, b.Status, b.CreatedAt, b.UpdatedAt, b.CheckInDate, b.CheckOutDate,
            b.AdultCount, b.ChildCount, b.CustomerNote, b.Subtotal, b.DiscountAmount, b.ServiceFee, b.TaxAmount,
            b.TotalAmount, b.CommissionRate,
            Customer = db.Users.Where(u => u.Id == b.CustomerId).Select(u => new { u.Id, u.FullName, u.Email, u.PhoneNumber }).First(),
            Host = db.Homestays.Where(h => h.Id == b.HomestayId).Select(h => db.Users.Where(u => u.Id == h.HostId).Select(u => new { u.Id, u.FullName, u.Email, u.PhoneNumber }).First()).First(),
            Homestay = db.Homestays.Where(h => h.Id == b.HomestayId).Select(h => new { h.Id, h.Name, h.Status }).First(),
            Rooms = b.Details.Select(d => new { d.Id, d.RoomTypeId, RoomTypeName = db.RoomTypes.Where(r => r.Id == d.RoomTypeId).Select(r => r.Name).First(), d.RoomId, RoomNumber = db.Rooms.Where(r => r.Id == d.RoomId).Select(r => r.RoomNumber).FirstOrDefault(), d.Quantity, d.PricePerNight, d.NumberOfNights, d.ExtraFee, d.LineTotal }).ToList(),
            Payments = b.Payments.OrderBy(p => p.CreatedAt).Select(p => new { p.Id, p.TransactionCode, p.TransactionType, p.PaymentMethod, p.Amount, p.Status, p.ResponseCode, p.BankCode, p.CreatedAt, p.PaidAt }).ToList(),
            Cancellation = db.Cancellations.Where(c => c.BookingId == b.Id).Select(c => new { c.Reason, c.CancellationFee, c.RefundAmount, c.Status, c.CancelledAt, c.ProcessedAt }).FirstOrDefault(),
            Audit = db.AuditLogs.Where(a => a.TargetType == "booking" && a.TargetId == b.Id.ToString()).OrderBy(a => a.CreatedAt).Select(a => new { a.Action, a.Reason, a.CreatedAt, a.ActorId }).ToList()
        }).SingleOrDefaultAsync();
        return item is null ? NotFound(new { message = "Không tìm thấy đơn đặt phòng." }) : Ok(item);
    }

    [HttpPatch("{id:long}/status"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> ChangeStatus(long id, AdminBookingDecision request)
    {
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 500)
            return BadRequest(new { message = "Vui lòng nhập lý do, tối đa 500 ký tự." });
        if (request.Status == "Cancelled") return BadRequest(new { message = "Hãy dùng luồng hủy đơn để tính chính sách hoàn tiền." });
        await using var transaction = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, id);
        var booking = await db.Bookings.SingleOrDefaultAsync(b => b.Id == id);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        var allowed = booking.Status switch { "PendingPayment" => request.Status == "Confirmed", "Confirmed" => request.Status == "CheckedIn",
            "CheckedIn" => request.Status == "Completed", _ => false };
        if (!allowed) return BadRequest(new { message = "Bước chuyển trạng thái không hợp lệ." });
        if (request.Status == "Confirmed" && !await db.Payments.AnyAsync(p => p.BookingId == id && p.TransactionType == "Payment" && p.Status == "Success" && p.Amount == booking.TotalAmount))
            return BadRequest(new { message = "Chưa có giao dịch thành công khớp số tiền; không thể xác nhận thủ công." });
        var before = new { booking.Status };
        booking.Status = request.Status!; booking.UpdatedAt = DateTime.UtcNow;
        audit.Add(HttpContext, "booking.status_change", "booking", id, before, new { booking.Status }, request.Reason);
        await db.SaveChangesAsync(); await transaction.CommitAsync();
        return Ok(new { message = "Đã cập nhật trạng thái đơn." });
    }

    [HttpPost("{id:long}/cancel"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> Cancel(long id, AdminBookingDecision request)
    {
        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 500)
            return BadRequest(new { message = "Vui lòng nhập lý do hủy, tối đa 500 ký tự." });
        await using var transaction = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, id);
        var booking = await db.Bookings.SingleOrDefaultAsync(b => b.Id == id);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        if (!BookingRules.CanCancel(booking.Status, booking.UpdatedAt, booking.CheckInDate, BookingRules.Today, DateTime.UtcNow))
            return BadRequest(new { message = "Đơn không còn đủ điều kiện hủy." });
        if (await db.Cancellations.AnyAsync(c => c.BookingId == id)) return Conflict(new { message = "Đơn đã có yêu cầu hủy." });
        var paid = await db.Payments.Where(p => p.BookingId == id && p.TransactionType == "Payment" && p.Status == "Success").SumAsync(p => (decimal?)p.Amount) ?? 0;
        var days = booking.CheckInDate.DayNumber - BookingRules.Today.DayNumber;
        var fee = days >= 7 ? 0m : decimal.Round(paid * .5m, 0);
        var refund = paid - fee;
        var actorId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var now = DateTime.UtcNow;
        var before = new { booking.Status };
        booking.Status = "Cancelled"; booking.UpdatedAt = now;
        db.Cancellations.Add(new Cancellation { BookingId = id, CancelledBy = actorId, Reason = reason,
            CancelledAt = now, CancellationFee = fee, RefundAmount = refund, Status = refund > 0 ? "Approved" : "Refunded",
            ProcessedBy = actorId, ProcessedAt = now });
        if (refund > 0 && !await db.Payments.AnyAsync(p => p.BookingId == id && p.TransactionType == "Refund"))
            db.Payments.Add(new Payment { BookingId = id, TransactionCode = $"RF{Guid.NewGuid():N}"[..30].ToUpperInvariant(),
                PaymentMethod = "VNPay", TransactionType = "Refund", Amount = refund, Status = "Pending",
                GatewayResponse = "Admin cancellation; manual refund reconciliation required", CreatedAt = now, UpdatedAt = now });
        audit.Add(HttpContext, "booking.cancel", "booking", id, before, new { booking.Status, cancellationFee = fee, refundAmount = refund }, reason);
        await db.SaveChangesAsync(); await transaction.CommitAsync();
        return Ok(new { message = refund > 0 ? "Đã hủy đơn và tạo yêu cầu hoàn tiền chờ xử lý." : "Đã hủy đơn.", cancellationFee = fee, refundAmount = refund });
    }

    [HttpGet("overbooking")]
    public async Task<IActionResult> Overbooking([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 100);
        var blocked = db.BookingConflictEvents.AsNoTracking().OrderByDescending(x => x.CreatedAt);
        var total = await blocked.CountAsync();
        var items = await blocked.Skip((page - 1) * pageSize).Take(pageSize).Select(x => new { x.Id, x.CustomerId, x.RoomTypeId,
            RoomTypeName = db.RoomTypes.Where(r => r.Id == x.RoomTypeId).Select(r => r.Name).First(), x.CheckInDate, x.CheckOutDate,
            x.RequestedQuantity, x.AvailableQuantity, x.CreatedAt }).ToListAsync();
        var overlaps = await (from a in db.BookingDetails.AsNoTracking()
            join b in db.BookingDetails.AsNoTracking() on a.RoomId equals b.RoomId
            where a.RoomId != null && a.BookingId < b.BookingId &&
                BookingRules.ReservedStatuses.Contains(a.Booking.Status) && BookingRules.ReservedStatuses.Contains(b.Booking.Status) &&
                a.Booking.CheckInDate < b.Booking.CheckOutDate && b.Booking.CheckInDate < a.Booking.CheckOutDate
            select new { roomId = a.RoomId, firstBookingId = a.BookingId, secondBookingId = b.BookingId,
                firstCode = a.Booking.BookingCode, secondCode = b.Booking.BookingCode,
                startDate = a.Booking.CheckInDate > b.Booking.CheckInDate ? a.Booking.CheckInDate : b.Booking.CheckInDate,
                to = a.Booking.CheckOutDate < b.Booking.CheckOutDate ? a.Booking.CheckOutDate : b.Booking.CheckOutDate })
            .Take(50).ToListAsync();
        return Ok(new { blocked = new { items, page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) }, overlaps });
    }
}
