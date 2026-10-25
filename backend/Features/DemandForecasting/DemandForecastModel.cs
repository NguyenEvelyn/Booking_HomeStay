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
    // The model whose forecast is served: the main model, or a baseline that beat it in the walk-forward backtest.
    public string ServedModel { get; init; } = "seasonal-trend";
}

public static class DemandForecastModel
{
    public const string Version = "seasonal-trend-v3";
    public const string SelectedModel = "seasonal-trend";
    private const int MinResidualsForInterval = 6;
    private static readonly string[] Models = [SelectedModel, "naive", "moving-average-3", "seasonal-naive"];
    private static readonly Dictionary<string, string> Labels = new()
    {
        [SelectedModel] = "Seasonal Trend v3",
        ["naive"] = "Naive (tháng gần nhất)",
        ["moving-average-3"] = "Trung bình trượt 3 tháng",
        ["seasonal-naive"] = "Seasonal Naive (cùng tháng năm trước)"
    };

    public static DemandForecastResult Forecast(IReadOnlyList<MonthlyDemand> source, int horizon, string? region)
    {
        var history = FillMissingMonths(source.OrderBy(x => x.Month).ToList());
        var totalBookings = history.Sum(x => x.Bookings);
        var (backtest, residuals) = Backtest(history);
        if (history.Count < 6 || totalBookings < 20)
            return new(Version, "insufficient_data",
                "Cần tối thiểu 6 tháng lịch sử và 20 booking để bắt đầu dự báo.", region,
                history.Count, totalBookings, history, [], backtest);

        var served = backtest?.Winner ?? SelectedModel;
        var predictions = Predict(history, Math.Clamp(horizon, 1, 12), served,
            residuals.GetValueOrDefault(served) ?? []);
        var warning = history.Count < 12
            ? "Chưa đủ một chu kỳ 12 tháng; chưa thể so sánh walk-forward công bằng với baseline mùa vụ."
            : totalBookings < 100 ? "Quy mô mẫu còn nhỏ; nên dùng khoảng dự báo thay vì một giá trị duy nhất."
            : served != SelectedModel
                ? $"Baseline \"{Labels[served]}\" có sai số backtest thấp hơn mô hình chính nên đang được dùng để dự báo."
            : backtest is { MeetsProjectTarget: false }
                ? "Mô hình chưa đạt mục tiêu đồ án: WAPE ≤ 30% và thắng ít nhất 2/3 baseline."
                : null;
        return new(Version, "ready", warning, region, history.Count, totalBookings, history, predictions, backtest)
        {
            ServedModel = served
        };
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

    /// <summary>Point forecasts (bookings) for the next <paramref name="horizon"/> months of one model.</summary>
    public static IReadOnlyList<double> PointForecast(string model, IReadOnlyList<MonthlyDemand> history, int horizon)
    {
        var lastMonth = history[^1].Month;
        var recentBookings = history.TakeLast(Math.Min(3, history.Count)).Average(x => x.Bookings);
        return Enumerable.Range(1, horizon).Select(step => model switch
        {
            "naive" => history[^1].Bookings,
            "moving-average-3" => recentBookings,
            "seasonal-naive" => SameMonthLastYear(history, lastMonth.AddMonths(step))?.Bookings ?? history[^1].Bookings,
            _ => SeasonalTrend(history, recentBookings, step)
        }).ToList();
    }

    // 55% same month last year (scaled by the year-over-year growth) + 45% three-month level with a damped trend.
    private static double SeasonalTrend(IReadOnlyList<MonthlyDemand> history, double recentBookings, int step)
    {
        var previous = history.Skip(Math.Max(0, history.Count - 6)).Take(Math.Min(3, Math.Max(0, history.Count - 3))).ToArray();
        var trend = previous.Length == 0 ? 0 : Math.Clamp((recentBookings - previous.Average(x => x.Bookings)) / 3,
            -recentBookings * .25, recentBookings * .25);
        var trendValue = Math.Max(0, recentBookings + trend * step);
        var seasonal = SameMonthLastYear(history, history[^1].Month.AddMonths(step));
        return seasonal is null ? trendValue : seasonal.Bookings * YearOverYearGrowth(history) * .55 + trendValue * .45;
    }

    // Last three months against the same three months a year earlier; without a full year of history, no growth.
    private static double YearOverYearGrowth(IReadOnlyList<MonthlyDemand> history)
    {
        if (history.Count < 15) return 1;
        var recent = history.TakeLast(3).Average(x => x.Bookings);
        var yearAgo = history.Skip(history.Count - 15).Take(3).Average(x => x.Bookings);
        return yearAgo <= 0 ? 1 : Math.Clamp(recent / yearAgo, .5, 2);
    }

    private static MonthlyDemand? SameMonthLastYear(IReadOnlyList<MonthlyDemand> history, DateOnly month) =>
        history.LastOrDefault(x => x.Month.Month == month.Month && x.Month < month);

    private static List<DemandPrediction> Predict(IReadOnlyList<MonthlyDemand> history, int horizon, string model,
        IReadOnlyList<double> residuals)
    {
        var recent = history.TakeLast(Math.Min(3, history.Count)).ToArray();
        var recentBookings = recent.Average(x => x.Bookings);
        var roomRatio = recentBookings <= 0 ? 0 : recent.Average(x => x.RoomNights) / recentBookings;
        var revenueRatio = recentBookings <= 0 ? 0 : recent.Average(x => (double)x.Revenue) / recentBookings;
        var points = PointForecast(model, history, horizon);
        return points.Select((point, index) =>
        {
            var bookings = Math.Max(0, (int)Math.Round(point));
            var (lower, upper) = Interval(bookings, residuals, index + 1, FallbackUncertainty(history));
            return new DemandPrediction(history[^1].Month.AddMonths(index + 1), bookings, lower, upper,
                Math.Max(0, (int)Math.Round(bookings * roomRatio)), Math.Max(0, decimal.Round((decimal)(bookings * revenueRatio), 0)));
        }).ToList();
    }

    // With enough out-of-sample errors the 80% interval is the 10th–90th percentile of past errors (widened by √step
    // for months further ahead); before that, a fixed ±% band that narrows as history grows.
    private static (int Lower, int Upper) Interval(int bookings, IReadOnlyList<double> residuals, int step, double fallback)
    {
        if (residuals.Count < MinResidualsForInterval)
            return (Math.Max(0, (int)Math.Floor(bookings * (1 - fallback))), (int)Math.Ceiling(bookings * (1 + fallback)));
        var spread = Math.Sqrt(step);
        var low = Math.Min(0, Quantile(residuals, .1)) * spread;
        var high = Math.Max(0, Quantile(residuals, .9)) * spread;
        return (Math.Max(0, (int)Math.Floor(bookings + low)), (int)Math.Ceiling(bookings + high));
    }

    private static double FallbackUncertainty(IReadOnlyList<MonthlyDemand> history) =>
        history.Count < 12 ? .4 : history.Sum(x => x.Bookings) < 100 ? .3 : .2;

    private static double Quantile(IReadOnlyList<double> values, double q)
    {
        var sorted = values.OrderBy(x => x).ToArray();
        var position = (sorted.Length - 1) * q;
        var below = (int)Math.Floor(position);
        var above = Math.Min(sorted.Length - 1, below + 1);
        return sorted[below] + (sorted[above] - sorted[below]) * (position - below);
    }

    // Expanding-window walk-forward: every model forecasts each month from the months before it only, and its
    // interval uses only the errors it made earlier, so the reported coverage is out-of-sample too.
    private static (DemandBacktest? Backtest, Dictionary<string, List<double>> Residuals) Backtest(IReadOnlyList<MonthlyDemand> history)
    {
        var residuals = Models.ToDictionary(model => model, _ => new List<double>());
        if (history.Count < 13) return (null, residuals);
        var observations = Models.ToDictionary(model => model, _ => new List<(int Actual, int Predicted, int? Lower, int? Upper)>());
        for (var index = 12; index < history.Count; index++)
        {
            var training = history.Take(index).ToArray();
            var actual = history[index].Bookings;
            foreach (var model in Models)
            {
                var predicted = Math.Max(0, (int)Math.Round(PointForecast(model, training, 1)[0]));
                var (lower, upper) = Interval(predicted, residuals[model], 1, FallbackUncertainty(training));
                observations[model].Add((actual, predicted, lower, upper));
                residuals[model].Add(actual - predicted);
            }
        }

        var scores = Models.Select(model => new DemandModelScore(model, Labels[model], Accuracy(observations[model]))).ToList();
        var winner = scores.OrderBy(x => x.Accuracy.Wape ?? double.MaxValue).ThenBy(x => x.Accuracy.Mae).First().Model;
        var selectedScore = scores.Single(x => x.Model == SelectedModel).Accuracy;
        var baselinesBeaten = scores.Count(x => x.Model != SelectedModel && Better(selectedScore, x.Accuracy));
        var meetsTarget = selectedScore.Wape is <= 30 && baselinesBeaten >= 2;
        return (new("expanding-window walk-forward; bắt đầu sau 12 tháng", winner,
            winner == SelectedModel, baselinesBeaten, meetsTarget, scores), residuals);
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
