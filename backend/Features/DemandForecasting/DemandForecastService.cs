using HomestayAuth.Api.Features.Bookings;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.DemandForecasting;

public sealed class DemandForecastService(AppDbContext db)
{
    private static readonly string[] DemandStatuses = [BookingStatus.Confirmed, BookingStatus.CheckedIn,
        BookingStatus.CheckoutPendingPayment, BookingStatus.CheckedOut];

    public async Task<DemandForecastResult> Forecast(string? region, int historyMonths, int horizon)
    {
        historyMonths = Math.Clamp(historyMonths, 6, 60);
        var currentMonth = new DateOnly(BookingRules.Today.Year, BookingRules.Today.Month, 1);
        var from = currentMonth.AddMonths(-historyMonths);
        var query = db.Bookings.AsNoTracking().Where(x => DemandStatuses.Contains(x.Status)
            && x.CheckInDate >= from && x.CheckInDate < currentMonth);
        if (!string.IsNullOrWhiteSpace(region))
        {
            var pattern = $"%{region.Trim()}%";
            query = query.Where(x => EF.Functions.ILike(x.Homestay.Province, pattern)
                || EF.Functions.ILike(x.Homestay.District, pattern));
        }
        var rows = await query.Select(x => new { x.CheckInDate, x.TotalAmount,
            RoomNights = x.Details.Sum(d => d.Quantity * d.NumberOfNights) }).ToListAsync();
        var monthly = rows.GroupBy(x => new { x.CheckInDate.Year, x.CheckInDate.Month })
            .Select(g => new MonthlyDemand(new DateOnly(g.Key.Year, g.Key.Month, 1), g.Count(),
                g.Sum(x => x.RoomNights), g.Sum(x => x.TotalAmount))).OrderBy(x => x.Month).ToList();
        return DemandForecastModel.Forecast(monthly, horizon, string.IsNullOrWhiteSpace(region) ? null : region.Trim());
    }

    public Task<List<string>> Regions() => db.Homestays.AsNoTracking().Where(x => x.Status == "Approved")
        .Select(x => x.Province).Distinct().OrderBy(x => x).ToListAsync();
}
