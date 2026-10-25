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
backtest với MAE/RMSE/WAPE/coverage. Model `seasonal-trend-v3` lấy 55% từ cùng tháng năm trước
(nhân hệ số tăng trưởng năm: ba tháng gần nhất so với cùng ba tháng năm trước, giới hạn 0,5–2) và
45% từ mức ba tháng gần nhất có xu hướng tắt dần. Model được so sánh công bằng với ba baseline:
tháng gần nhất, trung bình trượt ba tháng và cùng tháng năm trước.

Backtest dùng expanding window, bắt đầu sau 12 tháng lịch sử. Với bộ demo 24 tháng, mỗi model
có 12 dự báo ngoài mẫu. Mục tiêu tham khảo cho đồ án là WAPE không quá 30% và model chính thắng
ít nhất 2/3 baseline. Có thể chọn tỉnh trên trang Admin để kiểm tra riêng từng khu vực; khu vực
không đủ dữ liệu phải trả `insufficient_data`, không suy diễn từ kết quả toàn hệ thống.

- **Khoảng dự báo 80%:** khi đã có ít nhất 6 sai số walk-forward, khoảng dự báo là phân vị 10–90 của
  các sai số đó (nhân √bước cho các tháng xa hơn). Trong backtest, mỗi tháng chỉ dùng sai số của các
  tháng trước nó, nên coverage báo cáo cũng là số ngoài mẫu. Chưa đủ sai số thì dùng dải ±40/30/20%.
- **Model được phục vụ:** nếu một baseline có WAPE backtest thấp hơn mô hình chính, API dùng dự báo của
  baseline đó, ghi `servedModel` trong kết quả và hiện cảnh báo; khi hoà thì ưu tiên mô hình chính.
- Tháng hiện tại chưa kết thúc nên không được tính vào lịch sử.

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

## Giới hạn và hướng phát triển

- Một homestay riêng lẻ thường chưa đủ 20 booking; Host sẽ thấy `insufficient_data` kèm số booking
  hiện có, thay vì một dự báo suy diễn từ khu vực.
- Doanh thu và room-night được suy từ số booking dự báo theo tỷ lệ của ba tháng gần nhất; chưa có
  khoảng dự báo riêng cho hai chỉ số này.
- Khi dữ liệu đủ lớn: so sánh rolling backtest với Holt-Winters/Prophet/LightGBM. Chỉ quảng bá model
  mới nếu WAPE trên các tháng gần nhất tốt hơn baseline và không làm giảm chất lượng ở khu vực ít dữ liệu.
