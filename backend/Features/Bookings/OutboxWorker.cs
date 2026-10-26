using System.Text.Json;
using HomestayAuth.Api.Features.Auth.Services;
using HomestayAuth.Api.Features.Notifications;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed class OutboxWorker(IServiceScopeFactory scopeFactory, ILogger<OutboxWorker> logger) : BackgroundService
{
    private static readonly TimeSpan ReadNotificationRetention = TimeSpan.FromDays(90);
    private DateTime nextCleanupUtc = DateTime.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));
        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            // An unhandled exception here would stop the whole host, so a transient database
            // failure must only skip this tick.
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var email = scope.ServiceProvider.GetRequiredService<IEmailOtpSender>();
                var batch = await db.OutboxMessages.Where(x => x.Status == "Pending" && x.AvailableAt <= DateTime.UtcNow).OrderBy(x => x.Id).Take(20).ToListAsync(stoppingToken);
                foreach (var message in batch)
                {
                    try
                    {
                        if (message.Type == NotificationService.EmailOutboxType) await SendNotificationEmail(db, email, message.PayloadJson, stoppingToken);
                        // Other types: adapter point for VNPay/bank refund API and outbound webhooks.
                        // Manual/original-method refunds remain Pending until a gateway adapter confirms them.
                        message.Attempts++; message.Status = "Dispatched"; message.ProcessedAt = DateTime.UtcNow;
                        logger.LogInformation("Dispatched outbox message {MessageId} ({Type})", message.Id, message.Type);
                    }
                    catch (Exception ex)
                    {
                        message.Attempts++; message.LastError = ex.Message; message.AvailableAt = DateTime.UtcNow.AddMinutes(Math.Min(60, Math.Pow(2, message.Attempts)));
                        if (message.Attempts >= 8) message.Status = "Failed";
                    }
                }
                if (batch.Count > 0) await db.SaveChangesAsync(stoppingToken);

                if (DateTime.UtcNow >= nextCleanupUtc)
                {
                    var cutoff = DateTime.UtcNow - ReadNotificationRetention;
                    await db.Notifications.Where(x => x.ReadAt != null && x.ReadAt < cutoff).ExecuteDeleteAsync(stoppingToken);
                    nextCleanupUtc = DateTime.UtcNow.AddDays(1);
                }
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(exception, "Could not process outbox messages");
            }
        }
    }

    // Email copy of a notification. SendNotificationAsync is a no-op when SMTP is not configured.
    private static async Task SendNotificationEmail(AppDbContext db, IEmailOtpSender email, string payloadJson, CancellationToken ct)
    {
        using var payload = JsonDocument.Parse(payloadJson);
        var userId = payload.RootElement.GetProperty("userId").GetInt64();
        var user = await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => new { u.Email, u.FullName }).SingleOrDefaultAsync(ct);
        if (user is null || string.IsNullOrWhiteSpace(user.Email)) return;
        await email.SendNotificationAsync(user.Email, user.FullName, $"Tripio · {payload.RootElement.GetProperty("subject").GetString()}",
            payload.RootElement.GetProperty("body").GetString() ?? "");
    }
}
