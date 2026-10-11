namespace HomestayAuth.Api.Features.DemandForecasting;

public sealed record MonthlyDemand(DateOnly Month, int Bookings, int RoomNights, decimal Revenue);
public sealed record DemandPrediction(DateOnly Month, int Bookings, int Lower, int Upper, int RoomNights, decimal Revenue);
public sealed record DemandAccuracy(int Samples, double Mae, double Wape);
public sealed record DemandForecastResult(string ModelVersion, string Status, string? Warning, string? Region,
    int HistoryMonths, int HistoricalBookings, IReadOnlyList<MonthlyDemand> History,
    IReadOnlyList<DemandPrediction> Forecast, DemandAccuracy? Backtest);

public static class DemandForecastModel
{
    public const string Version = "seasonal-trend-v1";

    public static DemandForecastResult Forecast(IReadOnlyList<MonthlyDemand> source, int horizon, string? region)
    {
        var history = FillMissingMonths(source.OrderBy(x => x.Month).ToList());
        var totalBookings = history.Sum(x => x.Bookings);
        if (history.Count < 6 || totalBookings < 20)
            return new(Version, "insufficient_data",
                "Cần tối thiểu 6 tháng lịch sử và 20 booking để bắt đầu dự báo.", region,
                history.Count, totalBookings, history, [], Backtest(history));

        var predictions = Predict(history, Math.Clamp(horizon, 1, 12));
        var warning = history.Count < 12
            ? "Chưa đủ một chu kỳ 12 tháng; dự báo chủ yếu dựa trên xu hướng gần đây."
            : totalBookings < 100 ? "Quy mô mẫu còn nhỏ; nên dùng khoảng dự báo thay vì một giá trị duy nhất." : null;
        return new(Version, "ready", warning, region, history.Count, totalBookings, history, predictions, Backtest(history));
    }

    private static List<MonthlyDemand> FillMissingMonths(List<MonthlyDemand> source)
    {
        if (source.Count == 0) return [];
        var byMonth = source.ToDictionary(x => x.Month);
        var result = new List<MonthlyDemand>();
        for (var month = source[0].Month; month <= source[^1].Month; month = month.AddMonths(1))
            result.Add(byMonth.GetValueOrDefault(month) ?? new MonthlyDemand(month, 0, 0, 0));
        return result;
    }

    private static List<DemandPrediction> Predict(IReadOnlyList<MonthlyDemand> history, int horizon)
    {
        var result = new List<DemandPrediction>();
        var recent = history.TakeLast(Math.Min(3, history.Count)).ToArray();
        var previous = history.Skip(Math.Max(0, history.Count - 6)).Take(Math.Min(3, Math.Max(0, history.Count - 3))).ToArray();
        var recentBookings = recent.Average(x => x.Bookings);
        var recentRooms = recent.Average(x => x.RoomNights);
        var recentRevenue = recent.Average(x => (double)x.Revenue);
        var trend = previous.Length == 0 ? 0 : Math.Clamp((recentBookings - previous.Average(x => x.Bookings)) / 3, -recentBookings * .25, recentBookings * .25);
        var lastMonth = history[^1].Month;
        for (var step = 1; step <= horizon; step++)
        {
            var month = lastMonth.AddMonths(step);
            var seasonal = history.LastOrDefault(x => x.Month.Month == month.Month && x.Month < month);
            var trendValue = Math.Max(0, recentBookings + trend * step);
            var predicted = seasonal is null ? trendValue : seasonal.Bookings * .55 + trendValue * .45;
            var bookings = Math.Max(0, (int)Math.Round(predicted));
            var roomRatio = recentBookings <= 0 ? 0 : recentRooms / recentBookings;
            var revenueRatio = recentBookings <= 0 ? 0 : recentRevenue / recentBookings;
            var uncertainty = history.Count < 12 ? .4 : history.Sum(x => x.Bookings) < 100 ? .3 : .2;
            result.Add(new(month, bookings, Math.Max(0, (int)Math.Floor(bookings * (1 - uncertainty))),
                (int)Math.Ceiling(bookings * (1 + uncertainty)), Math.Max(0, (int)Math.Round(bookings * roomRatio)),
                Math.Max(0, decimal.Round((decimal)(bookings * revenueRatio), 0))));
        }
        return result;
    }

    private static DemandAccuracy? Backtest(IReadOnlyList<MonthlyDemand> history)
    {
        if (history.Count < 8) return null;
        var testMonths = Math.Min(6, Math.Max(2, history.Count / 4));
        double absoluteError = 0, actualTotal = 0;
        for (var index = history.Count - testMonths; index < history.Count; index++)
        {
            var training = history.Take(index).ToArray();
            var predicted = Predict(training, 1)[0].Bookings;
            absoluteError += Math.Abs(predicted - history[index].Bookings);
            actualTotal += history[index].Bookings;
        }
        return new(testMonths, Math.Round(absoluteError / testMonths, 2),
            actualTotal == 0 ? 0 : Math.Round(100 * absoluteError / actualTotal, 2));
    }
}
