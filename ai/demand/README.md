# AI 2 — Dự báo nhu cầu

Phiên bản đầu dùng dữ liệu booking thật để dự báo nhu cầu theo **tháng** và **khu vực**.
Mốc thời gian là tháng check-in, không phải tháng tạo đơn. Các đơn hủy, giữ chỗ hết hạn
và no-show không được dùng làm nhu cầu đã xác nhận.

## API Admin

```text
GET /api/admin/ai/demand-forecast?region=Kiên Giang&historyMonths=36&horizon=6
GET /api/admin/ai/demand-forecast/regions
```

Kết quả gồm số booking, room-night, doanh thu, khoảng dự báo, phiên bản model và walk-forward
backtest với MAE/RMSE/WAPE/coverage. Model `seasonal-trend-v2` kết hợp cùng tháng của năm trước
với xu hướng ba tháng gần nhất, rồi được so sánh công bằng với ba baseline: tháng gần nhất,
trung bình trượt ba tháng và cùng tháng năm trước.

Backtest dùng expanding window, bắt đầu sau 12 tháng lịch sử. Với bộ demo 24 tháng, mỗi model
có 12 dự báo ngoài mẫu. Mục tiêu tham khảo cho đồ án là WAPE không quá 30% và model chính thắng
ít nhất 2/3 baseline. Có thể chọn tỉnh trên trang Admin để kiểm tra riêng từng khu vực; khu vực
không đủ dữ liệu phải trả `insufficient_data`, không suy diễn từ kết quả toàn hệ thống.

## Điều kiện dữ liệu

- Dưới 6 tháng hoặc dưới 20 booking: trả `status=insufficient_data`, không tạo dự báo giả.
- Dưới 12 tháng: vẫn có thể dự báo nhưng cảnh báo chưa đủ một chu kỳ mùa vụ.
- Dưới 100 booking: trả khoảng dự báo rộng hơn.

## Dữ liệu mô phỏng cho demo đồ án

Khi database phát triển chưa có đủ lịch sử thật, chạy
`database/seed-demand-forecast-demo.sql` trên PostgreSQL/Neon. Script tạo 24 tháng booking
mô phỏng có xu hướng và mùa vụ, sử dụng homestay/loại phòng đang có. Script chạy lặp lại an
toàn và mọi booking đều có tiền tố `DFDEMO-` cùng nhãn `[SYNTHETIC]` để không bị nhầm với
dữ liệu khách hàng thật. Không dùng dữ liệu này để tuyên bố độ chính xác thực tế của mô hình.

## Bước tiếp theo khi dữ liệu đủ lớn

So sánh rolling backtest của baseline với Holt-Winters/Prophet/LightGBM. Chỉ quảng bá model
mới nếu WAPE trên các tháng gần nhất tốt hơn baseline và không làm giảm chất lượng ở khu vực
ít dữ liệu.
