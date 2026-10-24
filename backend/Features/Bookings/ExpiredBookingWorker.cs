using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed class ExpiredBookingWorker(IServiceScopeFactory scopeFactory, ILogger<ExpiredBookingWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var now = DateTime.UtcNow;
                var expiredIds = await db.Bookings.Where(x => x.Status == BookingStatus.Hold && x.HoldExpiresAt != null && x.HoldExpiresAt <= now).Select(x => x.Id).ToListAsync(stoppingToken);
                // Re-check the hold in the UPDATE itself: a retry payment may have renewed it after the SELECT.
                var count = await db.Bookings.Where(x => expiredIds.Contains(x.Id) && x.Status == BookingStatus.Hold && x.HoldExpiresAt != null && x.HoldExpiresAt <= now)
                    .ExecuteUpdateAsync(x => x.SetProperty(b => b.Status, BookingStatus.Expired).SetProperty(b => b.UpdatedAt, now), stoppingToken);
                if (count > 0) await db.BookingRoomStays.Where(x => expiredIds.Contains(x.BookingId) && x.Status == "Active" && x.Booking.Status == BookingStatus.Expired)
                    .ExecuteUpdateAsync(x => x.SetProperty(s => s.Status, "Cancelled"), stoppingToken);
                if (count > 0) logger.LogInformation("Cancelled {Count} expired booking holds", count);
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(exception, "Could not expire booking holds");
            }
        }
    }
}
