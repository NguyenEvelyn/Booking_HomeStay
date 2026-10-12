namespace HomestayAuth.Api.Features.DemandForecasting;

public sealed record MonthlyDemand(DateOnly Month, int Bookings, int RoomNights, decimal Revenue);
public sealed record DemandPrediction(DateOnly Month, int Bookings, int Lower, int Upper, int RoomNights, decimal Revenue);
public sealed record DemandAccuracy(int Samples, double Mae, double Rmse, double? Wape, double? IntervalCoverage);
public sealed record DemandModelScore(string Model, string Label, DemandAccuracy Accuracy);
public sealed record DemandBacktest(string Method, string Winner, bool SelectedModelWins, int BaselinesBeaten,
    bool MeetsProjectTarget, IReadOnlyList<DemandModelScore> Models);
public sealed record DemandForecastResult(string ModelVersion, string Status, string? Warning, string? Region,
    int HistoryMonths, int HistoricalBookings, IReadOnlyList<MonthlyDemand> History,
    IReadOnlyList<DemandPrediction> Forecast, DemandBacktest? Backtest)
{
    public bool HasSyntheticData { get; init; }
}

public static class DemandForecastModel
{
    public const string Version = "seasonal-trend-v2";
    private const string SelectedModel = "seasonal-trend";

    public static DemandForecastResult Forecast(IReadOnlyList<MonthlyDemand> source, int horizon, string? region)
    {
        var history = FillMissingMonths(source.OrderBy(x => x.Month).ToList());
        var totalBookings = history.Sum(x => x.Bookings);
        var backtest = Backtest(history);
        if (history.Count < 6 || totalBookings < 20)
            return new(Version, "insufficient_data",
                "Cần tối thiểu 6 tháng lịch sử và 20 booking để bắt đầu dự báo.", region,
                history.Count, totalBookings, history, [], backtest);

        var predictions = Predict(history, Math.Clamp(horizon, 1, 12));
        var warning = history.Count < 12
            ? "Chưa đủ một chu kỳ 12 tháng; chưa thể so sánh walk-forward công bằng với baseline mùa vụ."
            : totalBookings < 100 ? "Quy mô mẫu còn nhỏ; nên dùng khoảng dự báo thay vì một giá trị duy nhất."
            : backtest is { MeetsProjectTarget: false }
                ? "Mô hình chưa đạt mục tiêu đồ án: WAPE ≤ 30% và thắng ít nhất 2/3 baseline."
                : null;
        return new(Version, "ready", warning, region, history.Count, totalBookings, history, predictions, backtest);
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
        var trend = previous.Length == 0 ? 0 : Math.Clamp((recentBookings - previous.Average(x => x.Bookings)) / 3,
            -recentBookings * .25, recentBookings * .25);
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

    private static DemandBacktest? Backtest(IReadOnlyList<MonthlyDemand> history)
    {
        if (history.Count < 13) return null;
        var observations = new Dictionary<string, List<(int Actual, int Predicted, int? Lower, int? Upper)>>
        {
            [SelectedModel] = [], ["naive"] = [], ["moving-average-3"] = [], ["seasonal-naive"] = []
        };
        for (var index = 12; index < history.Count; index++)
        {
            var training = history.Take(index).ToArray();
            var actual = history[index].Bookings;
            var selected = Predict(training, 1)[0];
            observations[SelectedModel].Add((actual, selected.Bookings, selected.Lower, selected.Upper));
            observations["naive"].Add((actual, training[^1].Bookings, null, null));
            observations["moving-average-3"].Add((actual,
                (int)Math.Round(training.TakeLast(3).Average(x => x.Bookings)), null, null));
            observations["seasonal-naive"].Add((actual, training[^12].Bookings, null, null));
        }

        var labels = new Dictionary<string, string>
        {
            [SelectedModel] = "Seasonal Trend v2",
            ["naive"] = "Naive (tháng gần nhất)",
            ["moving-average-3"] = "Trung bình trượt 3 tháng",
            ["seasonal-naive"] = "Seasonal Naive (cùng tháng năm trước)"
        };
        var scores = observations.Select(pair => new DemandModelScore(pair.Key, labels[pair.Key], Accuracy(pair.Value))).ToList();
        var winner = scores.OrderBy(x => x.Accuracy.Wape ?? double.MaxValue).ThenBy(x => x.Accuracy.Mae).First().Model;
        var selectedScore = scores.Single(x => x.Model == SelectedModel).Accuracy;
        var baselinesBeaten = scores.Count(x => x.Model != SelectedModel && Better(selectedScore, x.Accuracy));
        var meetsTarget = selectedScore.Wape is <= 30 && baselinesBeaten >= 2;
        return new("expanding-window walk-forward; bắt đầu sau 12 tháng", winner,
            winner == SelectedModel, baselinesBeaten, meetsTarget, scores);
    }

    private static DemandAccuracy Accuracy(IReadOnlyList<(int Actual, int Predicted, int? Lower, int? Upper)> values)
    {
        var absoluteError = values.Sum(x => Math.Abs(x.Predicted - x.Actual));
        var squaredError = values.Sum(x => Math.Pow(x.Predicted - x.Actual, 2));
        var actualTotal = values.Sum(x => x.Actual);
        var intervals = values.Where(x => x.Lower.HasValue && x.Upper.HasValue).ToArray();
        return new(values.Count,
            Math.Round((double)absoluteError / values.Count, 2),
            Math.Round(Math.Sqrt(squaredError / values.Count), 2),
            actualTotal == 0 ? null : Math.Round(100d * absoluteError / actualTotal, 2),
            intervals.Length == 0 ? null : Math.Round(100d * intervals.Count(x => x.Actual >= x.Lower && x.Actual <= x.Upper) / intervals.Length, 2));
    }

    private static bool Better(DemandAccuracy selected, DemandAccuracy baseline) =>
        selected.Wape.HasValue && (!baseline.Wape.HasValue || selected.Wape < baseline.Wape)
        || selected.Wape == baseline.Wape && selected.Mae < baseline.Mae;
}
