using HomestayAuth.Api.Features.Auth.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

// When a confirmed guest is past the no-show grace period without checking in, email them once so they can
// still announce a late arrival before the host releases the room.
public sealed class NoShowReminderWorker(IServiceScopeFactory scopeFactory, IEmailOtpSender email, ILogger<NoShowReminderWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                if (!email.IsConfigured) continue;
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var noShows = scope.ServiceProvider.GetRequiredService<NoShowService>();
                var today = BookingRules.Today;
                var candidates = await db.Bookings.Where(b => b.Status == BookingStatus.Confirmed && b.NoShowReminderSentAt == null
                        && b.CheckInDate >= today.AddDays(-1) && b.CheckInDate <= today)
                    .Take(100).ToListAsync(stoppingToken);
                var now = DateTime.UtcNow;
                foreach (var booking in candidates)
                {
                    var context = await noShows.Context(booking, stoppingToken);
                    if (now < context.DeadlineUtc) continue;
                    // One failing address must not block (or resend) the others in this batch.
                    try
                    {
                        var user = await db.Users.AsNoTracking().Where(u => u.Id == booking.CustomerId).Select(u => new { u.Email, u.FullName }).SingleAsync(stoppingToken);
                        var to = string.IsNullOrWhiteSpace(booking.ContactEmail) ? user.Email : booking.ContactEmail;
                        await email.SendNotificationAsync(to, booking.ContactName ?? user.FullName,
                            $"Tripio: bạn chưa nhận phòng cho đơn {booking.BookingCode}",
                            $"Đơn {booking.BookingCode} đã quá giờ nhận phòng nhưng bạn chưa đến.\n"
                            + "Nếu bạn vẫn sẽ đến, hãy mở Tripio > Đơn của tôi và bấm \"Tôi sẽ đến muộn\" để chủ nhà giữ phòng, hoặc gọi trực tiếp cho chủ nhà.\n"
                            + $"Nếu không có phản hồi, chủ nhà có thể ghi nhận không đến và áp dụng chính sách: {NoShowRules.PenaltyLabel(context.Policy)}.");
                        booking.NoShowReminderSentAt = now;
                    }
                    catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
                    {
                        logger.LogWarning(exception, "Could not send no-show reminder for booking {BookingId}", booking.Id);
                    }
                }
                if (candidates.Count > 0) await db.SaveChangesAsync(stoppingToken);
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(exception, "Could not send no-show reminders");
            }
        }
    }
}
