using HomestayAuth.Api.Features.Notifications;
using System.Security.Claims;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Admin.Authorization;
using HomestayAuth.Api.Features.Auth.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record LateArrivalRequest(DateTime ExpectedArrivalAt, string? Note);
public sealed record NoShowMarkRequest(string? ContactNote);
public sealed record NoShowDisputeRequest(string? Reason);
public sealed record NoShowDisputeDecisionRequest(bool Accept, string? Note);

// No-show lifecycle: the guest may announce a late arrival; after the grace period the host may release the
// room (keeping the penalty, refunding the rest); the guest may dispute within 48 hours; an admin decides.
[ApiController, Route("api"), Authorize]
public sealed class NoShowController(AppDbContext db, NoShowService noShows, PaymentService payments,
    IEmailOtpSender email, ILogger<NoShowController> logger, NotificationService notifications) : ControllerBase
{
    private long UserId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string Role => User.FindFirstValue(ClaimTypes.Role) ?? "Customer";

    [HttpPost("bookings/{id:long}/late-arrival")]
    public async Task<IActionResult> AnnounceLateArrival(long id, LateArrivalRequest request)
    {
        await using var tx = await db.Database.BeginTransactionAsync(); await BookingAvailability.LockBooking(db, id);
        var booking = await db.Bookings.SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == UserId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        if (!NoShowService.AwaitingArrival(booking.Status)) return Conflict(new { message = "Chỉ báo đến muộn cho đơn đã xác nhận và chưa nhận phòng." });
        var context = await noShows.Context(booking);
        var expected = request.ExpectedArrivalAt.ToUniversalTime();
        if (NoShowRules.ValidateExpectedArrival(booking.CheckInDate, context.CheckInTime, context.Zone, expected, DateTime.UtcNow) is { } error)
            return BadRequest(new { message = error });
        var note = request.Note?.Trim();
        if (note?.Length > 500) return BadRequest(new { message = "Ghi chú tối đa 500 ký tự." });
        booking.ExpectedArrivalAt = expected; booking.LateArrivalNote = string.IsNullOrEmpty(note) ? null : note; booking.UpdatedAt = DateTime.UtcNow;
        Audit("booking.late_arrival", id, new { expectedArrivalAt = expected, note }, null);
        await notifications.NotifyHostOfHomestay(booking.HomestayId, NotificationTemplates.LateArrival(booking.Id, booking.BookingCode,
            booking.ContactName ?? "Khách", TimeZoneInfo.ConvertTimeFromUtc(expected, context.Zone)));
        db.OutboxMessages.Add(new OutboxMessage { Type = "booking.late_arrival", PayloadJson = JsonSerializer.Serialize(new { bookingId = id, booking.BookingCode, expectedArrivalAt = expected }), Status = "Pending", AvailableAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync(); await tx.CommitAsync();
        var newDeadline = NoShowRules.DeadlineUtc(booking.CheckInDate, context.CheckInTime, context.Zone, context.Policy, expected);
        return Ok(new { message = "Đã báo chủ nhà bạn sẽ đến muộn. Phòng được giữ cho bạn.", expectedArrivalAt = expected, holdUntil = newDeadline });
    }

    [Authorize(Roles = "Host"), HttpGet("bookings/{id:long}/no-show/quote")]
    public async Task<IActionResult> Quote(long id)
    {
        var booking = await HostBooking(id).AsNoTracking().SingleOrDefaultAsync();
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        var context = await noShows.Context(booking);
        return Ok(new
        {
            booking.Id, booking.BookingCode, booking.Status, deadline = context.DeadlineUtc,
            canMark = NoShowService.CannotMarkReason(booking, context, DateTime.UtcNow) is null,
            reason = NoShowService.CannotMarkReason(booking, context, DateTime.UtcNow),
            booking.ExpectedArrivalAt, booking.LateArrivalNote,
            paidAmount = context.PaidAmount, retainedAmount = context.Retained, refundAmount = context.Refund,
            penalty = context.Policy.Penalty, penaltyLabel = NoShowRules.PenaltyLabel(context.Policy), graceHours = context.Policy.GraceHours
        });
    }

    [Authorize(Roles = "Host"), HttpPost("bookings/{id:long}/no-show")]
    public async Task<IActionResult> Mark(long id, NoShowMarkRequest request)
    {
        var note = request.ContactNote?.Trim();
        if (note is null || note.Length < 10 || note.Length > 1000)
            return BadRequest(new { message = "Vui lòng ghi lại việc đã liên hệ khách (ví dụ: đã gọi 2 lần lúc 20:00 và 20:30, không bắt máy), từ 10 đến 1000 ký tự." });
        await using var tx = await db.Database.BeginTransactionAsync(); await BookingAvailability.LockBooking(db, id);
        var booking = await HostBooking(id).SingleOrDefaultAsync();
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        var context = await noShows.Context(booking);
        var now = DateTime.UtcNow;
        if (NoShowService.CannotMarkReason(booking, context, now) is { } reason) return Conflict(new { message = reason });

        booking.Status = BookingStatus.NoShow; booking.UpdatedAt = now;
        if (context.Refund > 0) booking.PaymentStatus = PaymentStatus.RefundPending;
        // Release the rooms so they can be sold again tonight, and drop charges that were never incurred.
        await db.BookingRoomStays.Where(x => x.BookingId == id && x.Status == "Active").ExecuteUpdateAsync(x => x.SetProperty(s => s.Status, "Cancelled"));
        await db.AdditionalCharges.Where(x => x.BookingId == id && !x.IsPaid).ExecuteUpdateAsync(x => x.SetProperty(c => c.Status, ChargeStatus.Waived).SetProperty(c => c.TotalPrice, 0));
        payments.QueueRefund(id, context.Refund, $"Khách không đến: {NoShowRules.PenaltyLabel(context.Policy)}");
        db.BookingNoShows.Add(new BookingNoShow { BookingId = id, MarkedBy = UserId, MarkedAt = now, ContactNote = note, Penalty = context.Policy.Penalty,
            PaidAmount = context.PaidAmount, RetainedAmount = context.Retained, RefundAmount = context.Refund });
        Audit("booking.no_show", id, new { context.PaidAmount, context.Retained, context.Refund, context.Policy.Penalty, deadline = context.DeadlineUtc }, note);
        notifications.Notify(booking.CustomerId, NotificationTemplates.NoShowMarked(booking.Id, booking.BookingCode));
        await db.SaveChangesAsync(); await tx.CommitAsync();

        await Notify(booking, "Tripio: đơn của bạn đã được ghi nhận không đến nhận phòng",
            $"Đơn {booking.BookingCode} đã được chủ nhà ghi nhận là không đến nhận phòng sau thời gian chờ.\n"
            + $"Số tiền đã thanh toán: {context.PaidAmount:N0}đ. Chủ nhà giữ lại: {context.Retained:N0}đ. Hoàn lại cho bạn: {context.Refund:N0}đ.\n"
            + $"Nếu bạn cho rằng việc này không đúng (ví dụ bạn đã đến hoặc đã báo đến muộn), hãy gửi khiếu nại trong mục Đơn của tôi trong vòng {NoShowRules.DisputeWindowHours} giờ.");
        return Ok(new { booking.Status, booking.PaymentStatus, retainedAmount = context.Retained, refundAmount = context.Refund,
            message = $"Đã xác nhận khách không đến và trả phòng để bán lại. Giữ lại {context.Retained:N0}đ, hoàn khách {context.Refund:N0}đ." });
    }

    [HttpPost("bookings/{id:long}/no-show/dispute")]
    public async Task<IActionResult> Dispute(long id, NoShowDisputeRequest request)
    {
        var reason = request.Reason?.Trim();
        if (reason is null || reason.Length < 10 || reason.Length > 1000) return BadRequest(new { message = "Vui lòng mô tả lý do khiếu nại từ 10 đến 1000 ký tự." });
        await using var tx = await db.Database.BeginTransactionAsync(); await BookingAvailability.LockBooking(db, id);
        if (!await db.Bookings.AnyAsync(x => x.Id == id && x.CustomerId == UserId && x.Status == BookingStatus.NoShow))
            return NotFound(new { message = "Không tìm thấy đơn không đến của bạn." });
        var record = await db.BookingNoShows.SingleOrDefaultAsync(x => x.BookingId == id);
        if (record is null) return NotFound(new { message = "Đơn này không có biên bản không đến để khiếu nại." });
        if (record.DisputeStatus is not null) return Conflict(new { message = "Bạn đã gửi khiếu nại cho đơn này." });
        if (DateTime.UtcNow > record.MarkedAt.AddHours(NoShowRules.DisputeWindowHours)) return Conflict(new { message = $"Đã quá {NoShowRules.DisputeWindowHours} giờ kể từ khi ghi nhận không đến." });
        record.DisputeStatus = NoShowDisputeStatus.Pending; record.DisputeReason = reason; record.DisputedAt = DateTime.UtcNow;
        Audit("booking.no_show_disputed", id, new { record.RetainedAmount }, reason);
        await notifications.NotifyStaff(NotificationTemplates.StaffNoShowDispute(await db.Bookings.Where(x => x.Id == id).Select(x => x.BookingCode).SingleAsync()));
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return Ok(new { message = "Đã gửi khiếu nại. Quản trị viên sẽ xem xét và phản hồi qua email." });
    }

    [Authorize(Policy = AdminPolicies.Access), HttpGet("admin/no-show-disputes")]
    public async Task<IActionResult> Disputes([FromQuery] string? status)
    {
        var query = db.BookingNoShows.AsNoTracking().Where(x => x.DisputeStatus != null);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.DisputeStatus == status);
        var items = await query.OrderBy(x => x.DisputeStatus == NoShowDisputeStatus.Pending ? 0 : 1).ThenByDescending(x => x.DisputedAt)
            .Join(db.Bookings, n => n.BookingId, b => b.Id, (n, b) => new
            {
                n.BookingId, b.BookingCode, b.CheckInDate, b.ExpectedArrivalAt, b.LateArrivalNote, homestay = b.Homestay.Name,
                customer = b.ContactName ?? b.GuestName, n.MarkedAt, n.ContactNote, n.Penalty, n.PaidAmount, n.RetainedAmount, n.RefundAmount,
                n.DisputeStatus, n.DisputeReason, n.DisputedAt, n.ResolvedAt, n.ResolutionNote
            }).Take(200).ToListAsync();
        return Ok(new { items });
    }

    [Authorize(Policy = AdminPolicies.FullAccess), HttpPatch("admin/no-show-disputes/{bookingId:long}")]
    public async Task<IActionResult> Decide(long bookingId, NoShowDisputeDecisionRequest request)
    {
        var note = request.Note?.Trim();
        if (note is null || note.Length < 5 || note.Length > 1000) return BadRequest(new { message = "Vui lòng ghi kết luận xử lý (5–1000 ký tự)." });
        await using var tx = await db.Database.BeginTransactionAsync(); await BookingAvailability.LockBooking(db, bookingId);
        var record = await db.BookingNoShows.SingleOrDefaultAsync(x => x.BookingId == bookingId && x.DisputeStatus == NoShowDisputeStatus.Pending);
        if (record is null) return NotFound(new { message = "Không có khiếu nại đang chờ xử lý cho đơn này." });
        var booking = await db.Bookings.SingleAsync(x => x.Id == bookingId);
        var now = DateTime.UtcNow;
        record.DisputeStatus = request.Accept ? NoShowDisputeStatus.Accepted : NoShowDisputeStatus.Rejected;
        record.ResolvedBy = UserId; record.ResolvedAt = now; record.ResolutionNote = note;
        var extraRefund = 0m;
        if (request.Accept && record.RetainedAmount > 0)
        {
            // Upholding the guest's claim returns the amount the host had kept.
            extraRefund = record.RetainedAmount;
            payments.QueueRefund(bookingId, extraRefund, $"Chấp nhận khiếu nại không đến: {note}");
            record.RefundAmount += extraRefund; record.RetainedAmount = 0;
            booking.PaymentStatus = PaymentStatus.RefundPending; booking.UpdatedAt = now;
        }
        Audit(request.Accept ? "booking.no_show_dispute_accepted" : "booking.no_show_dispute_rejected", bookingId, new { extraRefund }, note);
        notifications.Notify(booking.CustomerId, NotificationTemplates.NoShowDisputeResult(booking.Id, booking.BookingCode, request.Accept));
        await db.SaveChangesAsync(); await tx.CommitAsync();
        await Notify(booking, "Tripio: kết quả xử lý khiếu nại đơn không đến",
            request.Accept
                ? $"Khiếu nại của bạn cho đơn {booking.BookingCode} đã được chấp nhận. Khoản {extraRefund:N0}đ sẽ được hoàn lại.\nGhi chú: {note}"
                : $"Khiếu nại của bạn cho đơn {booking.BookingCode} chưa được chấp nhận.\nGhi chú: {note}");
        return Ok(new { record.DisputeStatus, extraRefund, message = request.Accept ? $"Đã chấp nhận khiếu nại và tạo khoản hoàn {extraRefund:N0}đ." : "Đã từ chối khiếu nại." });
    }

    private IQueryable<Booking> HostBooking(long id) => db.Bookings.Where(x => x.Id == id && x.Homestay.HostId == UserId);

    private void Audit(string action, long bookingId, object after, string? reason) => db.AuditLogs.Add(new AuditLog { ActorId = UserId, ActorRole = Role,
        Action = action, TargetType = "Booking", TargetId = bookingId.ToString(), AfterJson = JsonSerializer.Serialize(after), Reason = reason,
        Ip = HttpContext.Connection.RemoteIpAddress, CreatedAt = DateTime.UtcNow });

    // Email is best effort: the state change is already committed and must not fail because SMTP is down.
    private async Task Notify(Booking booking, string subject, string body)
    {
        try
        {
            var user = await db.Users.AsNoTracking().Where(u => u.Id == booking.CustomerId).Select(u => new { u.Email, u.FullName }).SingleAsync();
            var to = string.IsNullOrWhiteSpace(booking.ContactEmail) ? user.Email : booking.ContactEmail;
            await email.SendNotificationAsync(to, booking.ContactName ?? user.FullName, subject, body);
        }
        catch (Exception exception) { logger.LogWarning(exception, "Could not send no-show email for booking {BookingId}", booking.Id); }
    }
}
