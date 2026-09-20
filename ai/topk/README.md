# Bước 1: Top-K cho Tripio

## Dữ liệu đang có

- Neon có 21 homestay được duyệt, loại phòng, giá, sức chứa, tiện nghi và đánh giá. Script `generate-demo.mjs` lấy các thuộc tính công khai này qua backend hiện có.
- Neon chưa có bảng lưu lịch sử tìm kiếm/lượt xem. Booking thật có trong bảng `bookings`, nhưng **không tạo booking hoặc thanh toán giả** để huấn luyện.
- `data/catalog.json` là ảnh chụp homestay thật. `data/demo-events.jsonl` là các phiên tìm kiếm, lượt xem và hành động đặt phòng **giả lập**, với `demo-user-*`; không chứa tài khoản hay thông tin cá nhân thật.

## Chạy bản đầu

Từ thư mục gốc `Booking_HomeStay`, khi backend đang chạy ở cổng 5000:

```powershell
node ai/topk/generate-demo.mjs
node --test ai/topk/model.test.mjs
node ai/topk/demo.mjs "Kiên Giang" 2 2500000 "WiFi miễn phí"
```

Có thể đổi API bằng `BOOKING_API_URL`. Bộ sinh dùng seed `20260920` (đổi qua `DEMO_SEED`) và tạo 300 phiên. Không ghi dữ liệu lên Neon.

## Chuẩn hóa và xếp hạng

Mỗi homestay được chuẩn hóa thành: `homestayId`, tỉnh/huyện, tập tiện nghi, điểm và số đánh giá, danh sách loại phòng với giá/giới hạn khách/tồn phòng. Mỗi truy vấn có địa điểm, số khách/phòng, số đêm, ngân sách **tổng kỳ nghỉ**, tiện nghi bắt buộc/ưa thích và có thể có ngày lưu trú.

1. **Lọc cứng:** địa điểm, tiện nghi bắt buộc, sức chứa, số phòng, ngân sách tổng. Khi dùng trên web cần gọi API khả dụng hiện có để lọc theo ngày trước khi xếp hạng; ảnh chụp offline chỉ biết trạng thái phòng tại lúc xuất dữ liệu.
2. **Điểm Top-K:** mức phù hợp ngân sách (40%), tiện nghi ưa thích (30%), điểm đánh giá đã làm mượt theo số lượng đánh giá (20%), hành vi trước đó (10%). Hành vi trống vẫn chạy được cho khách mới.
3. Trả Top 5 cùng loại phòng phù hợp, chi phí dự kiến và lý do gợi ý. Chi phí offline chỉ là ước tính theo giá cơ bản và phụ thu khách; khi đặt phòng phải dùng `/api/bookings/quote` để lấy giá đúng theo ngày.

Đây là **baseline có giải thích được**, chưa phải mô hình ML được huấn luyện. Không đánh giá chất lượng thật bằng các event giả, vì event được sinh theo thuộc tính của chính homestay.

## Bước tiếp theo để thành mô hình học từ dữ liệu

1. Áp dụng `events-schema.sql` khi muốn bắt đầu ghi sự kiện thật. Ghi `search` khi người dùng tìm, `view` khi mở chi tiết và `booking` khi đơn được xác nhận; chỉ lưu mã phiên, mã khách (nếu có) và tiêu chí tìm kiếm, không lưu email/số điện thoại.
2. Trích xuất booking đã xác nhận làm tín hiệu mạnh, lượt xem làm tín hiệu nhẹ; phân biệt `source=real` và `source=synthetic`. Dữ liệu giả dùng demo/kiểm thử đường ống, không dùng để báo cáo độ chính xác thực tế.
3. Chia tập theo **thời gian** và theo phiên/người dùng để tránh rò rỉ. So sánh Top-K với baseline giá thấp/đánh giá cao bằng Recall@5, NDCG@5, độ phủ homestay và tỷ lệ đặt phòng.
4. Khi có đủ sự kiện thật, học trọng số hoặc huấn luyện mô hình xếp hạng; sau đó đưa kết quả vào API gợi ý. Mô hình dự báo nhu cầu theo khu vực/tháng nên làm sau, từ booking thật đã tổng hợp theo thời gian.
