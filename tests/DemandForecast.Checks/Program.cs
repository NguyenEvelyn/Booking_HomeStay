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
Expect(ready.Backtest is { Samples: > 0 }, "Model đủ dữ liệu phải có backtest.");
Console.WriteLine("Demand forecast checks passed.");
