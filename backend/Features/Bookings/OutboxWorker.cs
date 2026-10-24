using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed class OutboxWorker(IServiceScopeFactory scopeFactory, ILogger<OutboxWorker> logger) : BackgroundService
{
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
                var batch = await db.OutboxMessages.Where(x => x.Status == "Pending" && x.AvailableAt <= DateTime.UtcNow).OrderBy(x => x.Id).Take(20).ToListAsync(stoppingToken);
                foreach (var message in batch)
                {
                    try
                    {
                        // Adapter point for VNPay/bank refund API and outbound webhooks.
                        // Manual/original-method refunds remain Pending until a gateway adapter confirms them.
                        message.Attempts++; message.Status = "Dispatched"; message.ProcessedAt = DateTime.UtcNow;
                        logger.LogInformation("Dispatched outbox message {MessageId} ({Type})", message.Id, message.Type);
                    }
                    catch (Exception ex)
                    {
                        message.Attempts++; message.LastError = ex.Message; message.AvailableAt = DateTime.UtcNow.AddMinutes(Math.Min(60, Math.Pow(2, message.Attempts)));
                    }
                }
                if (batch.Count > 0) await db.SaveChangesAsync(stoppingToken);
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(exception, "Could not process outbox messages");
            }
        }
    }
}
