using HomestayAuth.Api.Features.DemandForecasting;

static void Expect(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

var start = new DateOnly(2025, 1, 1);
var insufficient = DemandForecastModel.Forecast([
    new MonthlyDemand(start, 3, 6, 3_000_000)
], 6, "Kiên Giang");
Expect(insufficient.Status == "insufficient_data", "Dữ liệu nhỏ phải bị từ chối dự báo.");
Expect(insufficient.Forecast.Count == 0, "Không được tạo dự báo giả khi thiếu dữ liệu.");

var history = Enumerable.Range(0, 18).Select(index => {
    var month = start.AddMonths(index);
    var seasonal = month.Month is >= 5 and <= 8 ? 18 : 9;
    return new MonthlyDemand(month, seasonal + index / 6, (seasonal + index / 6) * 2,
        (seasonal + index / 6) * 1_000_000m);
}).ToArray();
var ready = DemandForecastModel.Forecast(history, 6, "Kiên Giang");
Expect(ready.Status == "ready", "Lịch sử đủ phải sinh dự báo.");
Expect(ready.Forecast.Count == 6, "Horizon phải có đúng 6 tháng.");
Expect(ready.Forecast.All(x => x.Lower <= x.Bookings && x.Bookings <= x.Upper), "Khoảng dự báo phải chứa giá trị trung tâm.");
Expect(ready.ModelVersion == "seasonal-trend-v2", "Phải trả đúng phiên bản model đánh giá mới.");
Expect(ready.Backtest is not null, "Model đủ dữ liệu phải có walk-forward backtest.");
Expect(ready.Backtest!.Models.Count == 4, "Phải so sánh model với đúng ba baseline.");
Expect(ready.Backtest.Models.All(x => x.Accuracy.Samples == 6), "18 tháng phải tạo 6 mẫu walk-forward công bằng.");
Expect(ready.Backtest.Models.Select(x => x.Model).ToHashSet().SetEquals([
    "seasonal-trend", "naive", "moving-average-3", "seasonal-naive"
]), "Thiếu model hoặc baseline trong báo cáo.");
var selected = ready.Backtest.Models.Single(x => x.Model == "seasonal-trend").Accuracy;
Expect(selected.Wape.HasValue && selected.Rmse >= selected.Mae, "Phải tính WAPE, MAE và RMSE hợp lệ.");
Expect(selected.IntervalCoverage is >= 0 and <= 100, "Coverage khoảng dự báo phải nằm trong 0-100%.");

var zeroHistory = Enumerable.Range(0, 18)
    .Select(index => new MonthlyDemand(start.AddMonths(index), 0, 0, 0)).ToArray();
var zero = DemandForecastModel.Forecast(zeroHistory, 3, null);
Expect(zero.Backtest!.Models.All(x => x.Accuracy.Wape is null),
    "WAPE phải là null khi tổng nhu cầu thực bằng 0, không được báo sai là 0%.");

var demoPattern = Enumerable.Range(0, 24).Select(index => {
    var month = new DateOnly(2024, 10, 1).AddMonths(index);
    var peak = month.Month is >= 5 and <= 8 ? 8 : month.Month is 11 or 12 ? 4 : 0;
    var bookings = 8 + index / 6 + peak;
    return new MonthlyDemand(month, bookings, bookings * 2, bookings * 1_000_000m);
}).ToArray();
var demoEvaluation = DemandForecastModel.Forecast(demoPattern, 6, null);
Expect(demoEvaluation.Backtest!.Models.All(x => x.Accuracy.Samples == 12),
    "Bộ demo 24 tháng phải tạo đúng 12 điểm walk-forward cho mọi model.");
Console.WriteLine("Demand forecast checks passed.");
