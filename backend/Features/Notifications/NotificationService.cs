using System.Globalization;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Notifications;

public sealed record NotificationTarget(string Type, long? Id = null, string? Extra = null);
public sealed record NotificationMessage(string Type, string Title, string Body, NotificationTarget? Link, bool Email);

// Adds notifications to the caller's DbContext, so they are saved (or rolled back) together with the business
// change that caused them. Emails go through the outbox ("notification.email") and are sent by OutboxWorker.
public sealed class NotificationService(AppDbContext db)
{
    public const string EmailOutboxType = "notification.email";
    private static readonly string[] StaffRoles = ["Admin", "Support"];

    public void Notify(long userId, NotificationMessage message)
    {
        var now = DateTime.UtcNow;
        db.Notifications.Add(new Notification { UserId = userId, Type = message.Type, Title = Clip(message.Title, 150), Body = Clip(message.Body, 500),
            LinkType = message.Link?.Type, LinkId = message.Link?.Id, LinkExtra = message.Link?.Extra, CreatedAt = now });
        if (message.Email)
            db.OutboxMessages.Add(new OutboxMessage { Type = EmailOutboxType, Status = "Pending", AvailableAt = now, CreatedAt = now,
                PayloadJson = JsonSerializer.Serialize(new { userId, subject = message.Title, body = message.Body }) });
    }

    public async Task NotifyHostOfHomestay(long homestayId, NotificationMessage message)
    {
        var hostId = await db.Homestays.AsNoTracking().Where(h => h.Id == homestayId).Select(h => (long?)h.HostId).SingleOrDefaultAsync();
        if (hostId is { } id) Notify(id, message);
    }

    public async Task NotifyStaff(NotificationMessage message)
    {
        var staff = await db.Users.AsNoTracking().Where(u => StaffRoles.Contains(u.Role) && u.Status == "Active").Select(u => u.Id).ToListAsync();
        foreach (var id in staff) Notify(id, message with { Email = false });
    }

    private static string Clip(string value, int max) => value.Length <= max ? value : value[..(max - 1)] + "…";
}

// Vietnamese wording of every notification (pure, covered by tests/BookingRules.Checks).
public static class NotificationTemplates
{
    private static readonly CultureInfo Vi = CultureInfo.GetCultureInfo("vi-VN");
    private static string Day(DateOnly date) => date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
    private static string Money(decimal amount) => string.Format(Vi, "{0:N0}đ", amount);

    public static NotificationMessage BookingConfirmed(long bookingId, string code, string homestay, DateOnly checkIn, DateOnly checkOut) =>
        new("booking.confirmed", $"Đặt phòng thành công · {code}",
            $"Đơn tại {homestay} ({Day(checkIn)} – {Day(checkOut)}) đã được xác nhận. Chúc bạn có chuyến đi vui vẻ!",
            new(NotificationLink.Booking, bookingId), true);

    public static NotificationMessage NewBookingForHost(long bookingId, string code, string homestay, string guest, DateOnly checkIn, DateOnly checkOut) =>
        new("booking.new", $"Đơn mới đã thanh toán · {code}",
            $"{guest} đặt {homestay} từ {Day(checkIn)} đến {Day(checkOut)}.",
            new(NotificationLink.HostBooking, bookingId), true);

    public static NotificationMessage CancelledByHost(long bookingId, string code, string homestay, decimal refund) =>
        new("booking.cancelled_by_host", $"Chủ nhà đã hủy đơn {code}",
            refund > 0 ? $"Đơn tại {homestay} đã bị hủy. Bạn được hoàn {Money(refund)}, Tripio sẽ xử lý trong vài ngày làm việc."
                       : $"Đơn tại {homestay} đã bị hủy.",
            new(NotificationLink.Booking, bookingId), true);

    public static NotificationMessage CancelledByAdmin(long bookingId, string code, decimal refund) =>
        new("booking.cancelled_by_admin", $"Đơn {code} đã được Tripio hủy",
            refund > 0 ? $"Bạn được hoàn {Money(refund)}. Liên hệ hỗ trợ nếu cần thêm thông tin." : "Liên hệ hỗ trợ nếu cần thêm thông tin.",
            new(NotificationLink.Booking, bookingId), true);

    public static NotificationMessage CancelledByGuest(long bookingId, string code, string homestay, string guest, DateOnly checkIn) =>
        new("booking.cancelled_by_guest", $"Khách đã hủy đơn {code}",
            $"{guest} hủy đơn tại {homestay} (nhận phòng {Day(checkIn)}). Phòng đã được mở bán lại.",
            new(NotificationLink.HostBooking, bookingId), true);

    public static NotificationMessage RefundCompleted(long bookingId, string code, decimal amount) =>
        new("refund.completed", $"Đã hoàn tiền đơn {code}",
            $"Tripio đã hoàn {Money(amount)} về tài khoản thanh toán ban đầu của bạn.",
            new(NotificationLink.Booking, bookingId), true);

    public static NotificationMessage NoShowMarked(long bookingId, string code) =>
        new("booking.no_show", $"Đơn {code} được ghi nhận không đến",
            "Chủ nhà đã giải phóng phòng vì bạn không đến nhận phòng. Bạn có 48 giờ để khiếu nại nếu không đồng ý.",
            new(NotificationLink.Booking, bookingId), false);

    public static NotificationMessage NoShowDisputeResult(long bookingId, string code, bool accepted) =>
        new("booking.no_show_dispute", accepted ? $"Khiếu nại đơn {code} được chấp nhận" : $"Khiếu nại đơn {code} không được chấp nhận",
            accepted ? "Tripio đã chấp nhận khiếu nại và sẽ hoàn tiền theo quyết định." : "Quyết định không đến của chủ nhà được giữ nguyên.",
            new(NotificationLink.Booking, bookingId), false);

    public static NotificationMessage LateArrival(long bookingId, string code, string guest, DateTime expectedLocal) =>
        new("booking.late_arrival", $"Khách báo đến muộn · {code}",
            $"{guest} dự kiến đến lúc {expectedLocal:HH:mm dd/MM}. Vui lòng giữ phòng.",
            new(NotificationLink.HostBooking, bookingId), false);

    public static NotificationMessage NewReview(string homestay, int rating, string guest) =>
        new("review.new", $"Đánh giá mới {rating}★ cho {homestay}", $"{guest} vừa để lại đánh giá. Phản hồi sớm để giữ uy tín.",
            new(NotificationLink.HostTab, Extra: "reviews"), false);

    public static NotificationMessage HomestayDecision(string homestay, string status, string? reason) => status switch
    {
        "Approved" => new("homestay.approved", $"{homestay} đã được duyệt", "Homestay đã hiển thị cho khách và có thể nhận đặt phòng.",
            new(NotificationLink.HostTab, Extra: "homestays"), true),
        "Rejected" => new("homestay.rejected", $"{homestay} chưa được duyệt", $"Lý do: {reason}. Hãy chỉnh sửa rồi gửi duyệt lại.",
            new(NotificationLink.HostTab, Extra: "homestays"), true),
        "Suspended" => new("homestay.suspended", $"{homestay} đã bị tạm ẩn", $"Lý do: {reason}. Liên hệ Tripio để được hỗ trợ.",
            new(NotificationLink.HostTab, Extra: "homestays"), true),
        _ => new("homestay.restored", $"{homestay} đã hiển thị lại", "Homestay đã được khôi phục và nhận đặt phòng bình thường.",
            new(NotificationLink.HostTab, Extra: "homestays"), true)
    };

    public static NotificationMessage BannerDecision(string title, bool approved, string? note) =>
        new(approved ? "banner.approved" : "banner.rejected", approved ? "Deal của bạn đã lên banner trang chủ" : "Đề xuất banner chưa được duyệt",
            approved ? $"Banner “{title}” đang hiển thị trên trang chủ." : $"Banner “{title}”: {note}",
            new(NotificationLink.HostTab, Extra: "deals"), false);

    public static NotificationMessage HostRegistrationResult(bool approved, string? reason) => approved
        ? new("host_registration.approved", "Bạn đã trở thành đối tác Tripio", "Hồ sơ đã được duyệt. Hãy thêm loại phòng, phòng và gửi duyệt homestay đầu tiên.",
            new(NotificationLink.HostTab, Extra: "homestays"), true)
        : new("host_registration.rejected", "Hồ sơ đăng ký làm host chưa được duyệt", string.IsNullOrWhiteSpace(reason) ? "Bạn có thể bổ sung thông tin và gửi lại." : $"Lý do: {reason}.",
            null, true);

    public static NotificationMessage StaffNewHostRegistration(string applicant) =>
        new("staff.host_registration", "Hồ sơ đăng ký làm host mới", $"{applicant} vừa gửi hồ sơ đăng ký làm host.",
            new(NotificationLink.AdminTab, Extra: "host-registrations"), false);

    public static NotificationMessage StaffHomestaySubmitted(string homestay) =>
        new("staff.homestay_submitted", "Homestay chờ duyệt", $"{homestay} vừa được gửi duyệt.",
            new(NotificationLink.AdminTab, Extra: "homestays"), false);

    public static NotificationMessage StaffNoShowDispute(string code) =>
        new("staff.no_show_dispute", "Khiếu nại no-show mới", $"Khách khiếu nại quyết định không đến của đơn {code}.",
            new(NotificationLink.AdminTab, Extra: "no-show-disputes"), false);

    public static NotificationMessage StaffBannerProposed(string title) =>
        new("staff.banner_proposed", "Đề xuất banner deal mới", $"Host đề xuất banner “{title}”.",
            new(NotificationLink.AdminTab, Extra: "banners"), false);
}
