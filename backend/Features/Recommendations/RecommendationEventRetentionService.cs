using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Recommendations;

public sealed class RecommendationEventRetentionService(
    IServiceScopeFactory scopeFactory,
    ILogger<RecommendationEventRetentionService> logger) : BackgroundService
{
    private static int RetentionDays => int.TryParse(
        Environment.GetEnvironmentVariable("RECOMMENDATION_EVENT_RETENTION_DAYS"), out var days)
        ? Math.Clamp(days, 90, 3650)
        : 0;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (RetentionDays == 0)
        {
            logger.LogInformation("Recommendation event retention is disabled. Set RECOMMENDATION_EVENT_RETENTION_DAYS to enable it.");
            return;
        }
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
                var deleted = await db.RecommendationEvents.Where(x => x.OccurredAt < cutoff)
                    .ExecuteDeleteAsync(stoppingToken);
                if (deleted > 0)
                    logger.LogInformation("Deleted {Count} recommendation events older than {RetentionDays} days.", deleted, RetentionDays);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception error)
            {
                logger.LogError(error, "Recommendation event retention cleanup failed.");
            }
            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
        }
    }
}
