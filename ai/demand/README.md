# AI 2 — Dự báo nhu cầu

Phiên bản đầu dùng dữ liệu booking thật để dự báo nhu cầu theo **tháng** và **khu vực**.
Mốc thời gian là tháng check-in, không phải tháng tạo đơn. Các đơn hủy, giữ chỗ hết hạn
và no-show không được dùng làm nhu cầu đã xác nhận.

## API Admin

```text
GET /api/admin/ai/demand-forecast?region=Kiên Giang&historyMonths=36&horizon=6
GET /api/admin/ai/demand-forecast/regions
```

Kết quả gồm số booking, room-night, doanh thu, khoảng dự báo, phiên bản model và backtest
MAE/WAPE. Model `seasonal-trend-v1` kết hợp cùng tháng của năm trước với xu hướng ba tháng
gần nhất. Đây là baseline minh bạch để so sánh với các model nâng cao sau này.

## Điều kiện dữ liệu

- Dưới 6 tháng hoặc dưới 20 booking: trả `status=insufficient_data`, không tạo dự báo giả.
- Dưới 12 tháng: vẫn có thể dự báo nhưng cảnh báo chưa đủ một chu kỳ mùa vụ.
- Dưới 100 booking: trả khoảng dự báo rộng hơn.

## Bước tiếp theo khi dữ liệu đủ lớn

So sánh rolling backtest của baseline với Holt-Winters/Prophet/LightGBM. Chỉ quảng bá model
mới nếu WAPE trên các tháng gần nhất tốt hơn baseline và không làm giảm chất lượng ở khu vực
ít dữ liệu.
