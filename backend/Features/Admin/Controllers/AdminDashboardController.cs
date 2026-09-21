using HomestayAuth.Api.Features.Admin.Authorization;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HomestayAuth.Api.Features.Admin.Controllers;

[ApiController, Route("api/admin/dashboard"), Authorize(Policy = AdminPolicies.Access)]
public sealed class AdminDashboardController(AppDbContext db) : ControllerBase
{
    private static readonly string[] OccupiedStatuses = ["Confirmed", "CheckedIn", "Completed"];

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string range = "7days", [FromQuery] DateOnly? from = null, [FromQuery] DateOnly? to = null)
    {
        var zone = GetVietnamTimeZone();
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone));
        var (startDate, endDate) = ResolveRange(range, from, to, today);
        if (endDate < startDate || endDate.DayNumber - startDate.DayNumber > 365)
            return BadRequest(new { message = "Khoảng thời gian phải từ 1 đến 366 ngày." });
        var start = ToUtc(startDate, zone);
        var end = ToUtc(endDate.AddDays(1), zone);
        var duration = end - start;
        var previousStart = start - duration;
        var previousEnd = start;
        var commissionRate = decimal.TryParse(Environment.GetEnvironmentVariable("PLATFORM_COMMISSION_RATE"),
            System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var configuredRate)
            ? Math.Clamp(configuredRate, 0, 1) : .10m;

        var bookings = await CountPeriods(db.Bookings, x => x.CreatedAt, start, end, previousStart, previousEnd);
        var newUsers = await CountPeriods(db.Users.Where(x => x.Role == "Customer"), x => x.CreatedAt, start, end, previousStart, previousEnd);
        var newHosts = await CountPeriods(db.Users.Where(x => x.Role == "Host"), x => x.CreatedAt, start, end, previousStart, previousEnd);
        var gmv = await SumPayments(start, end);
        var previousGmv = await SumPayments(previousStart, previousEnd);
        var cancellation = await CancellationRate(start, end);
        var previousCancellation = await CancellationRate(previousStart, previousEnd);
        var occupancy = await OccupancyRate(startDate, endDate.AddDays(1));
        var previousOccupancy = await OccupancyRate(startDate.AddDays(-duration.Days), startDate);
        var activeHomestays = await db.Homestays.CountAsync(x => x.Status == "Approved" && x.ReviewedAt < end);
        var previousActiveHomestays = await db.Homestays.CountAsync(x => x.Status == "Approved" && x.ReviewedAt < previousEnd);

        var bookingSeries = await db.Bookings.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end)
            .GroupBy(x => x.CreatedAt.AddHours(7).Date).Select(g => new { date = g.Key, bookings = g.Count() }).OrderBy(x => x.date).ToListAsync();
        var revenueSeries = await db.Payments.AsNoTracking().Where(x => x.TransactionType == "Payment" && x.Status == "Success" && x.PaidAt >= start && x.PaidAt < end)
            .GroupBy(x => x.PaidAt!.Value.AddHours(7).Date).Select(g => new { date = g.Key, revenue = g.Sum(x => x.Amount) }).OrderBy(x => x.date).ToListAsync();
        var userSeries = await db.Users.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end)
            .GroupBy(x => x.CreatedAt.AddHours(7).Date).Select(g => new { date = g.Key, customers = g.Count(x => x.Role == "Customer"), hosts = g.Count(x => x.Role == "Host") }).OrderBy(x => x.date).ToListAsync();
        var topCities = await db.Bookings.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end)
            .GroupBy(x => db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.Province).First())
            .Select(g => new { name = g.Key, value = g.Count(), amount = g.Sum(x => x.TotalAmount) }).OrderByDescending(x => x.value).Take(5).ToListAsync();
        var topHosts = await db.Bookings.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end)
            .GroupBy(x => db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.HostId).First())
            .Select(g => new { id = g.Key, value = g.Count(), amount = g.Sum(x => x.TotalAmount) }).OrderByDescending(x => x.amount).Take(5).ToListAsync();
        var hostIds = topHosts.Select(x => x.id).ToArray();
        var hostNames = await db.Users.AsNoTracking().Where(x => hostIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.FullName);
        var topHomestays = await db.Bookings.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end)
            .GroupBy(x => x.HomestayId).Select(g => new { id = g.Key, value = g.Count(), amount = g.Sum(x => x.TotalAmount) })
            .OrderByDescending(x => x.amount).Take(5).ToListAsync();
        var homeIds = topHomestays.Select(x => x.id).ToArray();
        var homeNames = await db.Homestays.AsNoTracking().Where(x => homeIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name);
        var bookingStatuses = await db.Bookings.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end)
            .GroupBy(x => x.Status).Select(g => new { name = g.Key, value = g.Count() }).OrderByDescending(x => x.value).ToListAsync();

        var staleAt = DateTime.UtcNow.AddMinutes(-15);
        var pendingHomestays = await db.Homestays.CountAsync(x => x.Status == "Pending");
        var reportedReviews = await db.ReviewReports.CountAsync(x => x.Status == "Pending");
        var staleBookings = await db.Bookings.CountAsync(x => x.Status == "PendingPayment" && x.UpdatedAt < staleAt);
        var reconciliationIssues = await db.Payments.CountAsync(p => p.TransactionType == "Payment" && p.Status == "Success" &&
            (p.Booking.Status == "PendingPayment" || p.Booking.Status == "Cancelled" || p.Booking.Status == "Expired" || p.Amount != p.Booking.TotalAmount));

        return Ok(new
        {
            period = new { range, from = startDate, to = endDate, previousFrom = startDate.AddDays(-duration.Days), previousTo = startDate.AddDays(-1) },
            commissionRate,
            kpis = new
            {
                bookings = Kpi(bookings.Current, bookings.Previous),
                gmv = Kpi(gmv, previousGmv),
                commissionRevenue = Kpi(decimal.Round(gmv * commissionRate, 0), decimal.Round(previousGmv * commissionRate, 0)),
                newUsers = Kpi(newUsers.Current, newUsers.Previous), newHosts = Kpi(newHosts.Current, newHosts.Previous),
                activeHomestays = new { value = activeHomestays, change = Change(activeHomestays, previousActiveHomestays) },
                cancellationRate = new { value = cancellation, change = Change(cancellation, previousCancellation) },
                occupancyRate = new { value = occupancy, change = Change(occupancy, previousOccupancy) }
            },
            charts = new
            {
                revenueAndBookings = bookingSeries.Select(x => new { x.date, x.bookings, revenue = revenueSeries.Where(r => r.date == x.date).Select(r => r.revenue).FirstOrDefault() })
                    .Concat(revenueSeries.Where(r => !bookingSeries.Any(b => b.date == r.date)).Select(r => new { r.date, bookings = 0, r.revenue })).OrderBy(x => x.date),
                userGrowth = userSeries,
                topCities,
                topHosts = topHosts.Select(x => new { x.id, name = hostNames.GetValueOrDefault(x.id, "Host"), x.value, x.amount }),
                topHomestays = topHomestays.Select(x => new { x.id, name = homeNames.GetValueOrDefault(x.id, "Homestay"), x.value, x.amount }),
                bookingStatuses
            },
            attention = new { pendingHomestays, reportedReviews, staleBookings, reconciliationIssues }
        });
    }

    private async Task<decimal> SumPayments(DateTime start, DateTime end) => await db.Payments.AsNoTracking()
        .Where(x => x.TransactionType == "Payment" && x.Status == "Success" && x.PaidAt >= start && x.PaidAt < end)
        .SumAsync(x => (decimal?)x.Amount) ?? 0;

    private async Task<decimal> CancellationRate(DateTime start, DateTime end)
    {
        var query = db.Bookings.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        var total = await query.CountAsync();
        return total == 0 ? 0 : Math.Round(100m * await query.CountAsync(x => x.Status == "Cancelled") / total, 2);
    }

    private async Task<decimal> OccupancyRate(DateOnly start, DateOnly end)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open) await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT CASE WHEN capacity.room_nights = 0 THEN 0 ELSE
              ROUND(100.0 * COALESCE(occupied.booked_nights,0) / capacity.room_nights, 2) END
            FROM (SELECT COUNT(*) * (@end_date::date - @start_date::date) AS room_nights
                  FROM rooms r JOIN room_types rt ON rt.room_type_id=r.room_type_id
                  JOIN homestays h ON h.homestay_id=rt.homestay_id
                  WHERE r.status <> 'Inactive' AND rt.status='Active' AND h.status='Approved') capacity
            CROSS JOIN (SELECT COALESCE(SUM((LEAST(b.check_out_date,@end_date::date)-GREATEST(b.check_in_date,@start_date::date))*bd.quantity),0) AS booked_nights
                  FROM bookings b JOIN booking_details bd ON bd.booking_id=b.booking_id
                  WHERE b.status = ANY(@statuses) AND b.check_in_date < @end_date::date AND b.check_out_date > @start_date::date) occupied
            """;
        command.Parameters.Add(new NpgsqlParameter("start_date", start));
        command.Parameters.Add(new NpgsqlParameter("end_date", end));
        command.Parameters.Add(new NpgsqlParameter<string[]>("statuses", OccupiedStatuses));
        return Convert.ToDecimal(await command.ExecuteScalarAsync(), System.Globalization.CultureInfo.InvariantCulture);
    }

    private static async Task<(int Current, int Previous)> CountPeriods<T>(IQueryable<T> query, System.Linq.Expressions.Expression<Func<T, DateTime>> selector, DateTime start, DateTime end, DateTime previousStart, DateTime previousEnd)
    {
        var current = await query.CountAsync(BuildRange(selector, start, end));
        var previous = await query.CountAsync(BuildRange(selector, previousStart, previousEnd));
        return (current, previous);
    }

    private static System.Linq.Expressions.Expression<Func<T, bool>> BuildRange<T>(System.Linq.Expressions.Expression<Func<T, DateTime>> selector, DateTime start, DateTime end)
    {
        var body = System.Linq.Expressions.Expression.AndAlso(
            System.Linq.Expressions.Expression.GreaterThanOrEqual(selector.Body, System.Linq.Expressions.Expression.Constant(start)),
            System.Linq.Expressions.Expression.LessThan(selector.Body, System.Linq.Expressions.Expression.Constant(end)));
        return System.Linq.Expressions.Expression.Lambda<Func<T, bool>>(body, selector.Parameters);
    }

    private static object Kpi(decimal value, decimal previous) => new { value, change = Change(value, previous) };
    private static decimal Change(decimal value, decimal previous) => previous == 0 ? (value == 0 ? 0 : 100) : Math.Round((value - previous) * 100 / previous, 2);
    private static (DateOnly Start, DateOnly End) ResolveRange(string range, DateOnly? from, DateOnly? to, DateOnly today) => range switch
    {
        "today" => (today, today), "month" => (new DateOnly(today.Year, today.Month, 1), today),
        "custom" when from.HasValue && to.HasValue => (from.Value, to.Value), _ => (today.AddDays(-6), today)
    };
    private static DateTime ToUtc(DateOnly date, TimeZoneInfo zone) => TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), zone);
    private static TimeZoneInfo GetVietnamTimeZone()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"); }
    }
}
