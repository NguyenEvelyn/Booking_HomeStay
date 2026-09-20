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

1. **Lọc cứng:** địa điểm, tiện nghi bắt buộc, sức chứa, số phòng, ngân sách tổng. Bản trên web kiểm tra phòng trống theo ngày và các đơn đang giữ phòng trước khi xếp hạng; ảnh chụp offline chỉ biết trạng thái phòng tại lúc xuất dữ liệu.
2. **Điểm Top-K:** mức phù hợp ngân sách (40%), tiện nghi ưa thích (30%), điểm đánh giá đã làm mượt theo số lượng đánh giá (20%), hành vi trước đó (10%). Hành vi trống vẫn chạy được cho khách mới.
3. Trả Top 5 cùng loại phòng phù hợp, chi phí dự kiến và lý do gợi ý. Chi phí offline chỉ là ước tính theo giá cơ bản và phụ thu khách; khi đặt phòng phải dùng `/api/bookings/quote` để lấy giá đúng theo ngày.

Đây là **baseline có giải thích được**, chưa phải mô hình ML được huấn luyện. Không đánh giá chất lượng thật bằng các event giả, vì event được sinh theo thuộc tính của chính homestay.

## Gợi ý trên web

Trang tìm phòng gọi `GET /api/recommendations` với địa điểm, ngày lưu trú, số khách/phòng, ngân sách, loại phòng, điểm đánh giá và tiện nghi ưa thích. Backend đọc trực tiếp homestay và lịch sử đặt phòng thật trên Neon, kiểm tra phòng trống rồi trả Top-K cùng loại phòng, chi phí dự kiến và lý do. Dữ liệu sự kiện giả chỉ dùng cho bản demo offline và không được ghi vào Neon. Giá khi thanh toán vẫn lấy từ API báo giá đặt phòng.

## Sự kiện thật và đánh giá

- Backend tự tạo bảng `recommendation_events` khi khởi động. Sau khi tìm phòng thành công, web gửi `search` cùng tiêu chí và danh sách ID Top-K đã hiển thị. Khi mở trang chi tiết thành công, web gửi `view` với ID homestay. Hai sự kiện dùng cùng mã phiên ngẫu nhiên trong `sessionStorage`; nếu đã đăng nhập, backend tự gắn mã khách từ token. Frontend không gửi email, số điện thoại hoặc tên khách. Chỉ sự kiện `source=real` được ghi qua API này.
- `GET /api/recommendation-events/summary?days=30` dành cho Admin trả tổng lượt tìm, lượt xem, số phiên và tỷ lệ lượt tìm có mở ít nhất một gợi ý trong 24 giờ. Đây là **tỷ lệ mở gợi ý**, không phải tỷ lệ đặt phòng hay độ chính xác của mô hình. Khi lượng sự kiện còn ít, không nên dùng tỷ lệ này để kết luận thuật toán tốt hơn.
- Top-K hiện dùng lượt xem thật trong 90 ngày của cùng phiên làm một phần nhỏ của tín hiệu hành vi (tối đa 3/10 điểm), còn booking đã xác nhận có trọng số lớn hơn. Khách mới vẫn nhận gợi ý theo giá, tiện nghi và đánh giá. Có thể đối chiếu số liệu Admin trước/sau thay đổi trọng số; cần thí nghiệm nhóm A/B để kết luận tác động nhân quả.

## Bước tiếp theo để thành mô hình học từ dữ liệu

1. Gắn sự kiện `booking` khi đơn được xác nhận và đối chiếu với lượt xem/gợi ý trước đó. Hiện `search` và `view` đã được ghi tự động; booking thật đã có trong bảng `bookings` nhưng chưa liên kết với phiên tìm kiếm.
2. Trích xuất booking đã xác nhận làm tín hiệu mạnh, lượt xem làm tín hiệu nhẹ; phân biệt `source=real` và `source=synthetic`. Dữ liệu giả dùng demo/kiểm thử đường ống, không dùng để báo cáo độ chính xác thực tế.
3. Chia tập theo **thời gian** và theo phiên/người dùng để tránh rò rỉ. So sánh Top-K với baseline giá thấp/đánh giá cao bằng Recall@5, NDCG@5, độ phủ homestay và tỷ lệ đặt phòng.
4. Khi có đủ sự kiện thật, học trọng số hoặc huấn luyện mô hình xếp hạng; sau đó đưa kết quả vào API gợi ý. Mô hình dự báo nhu cầu theo khu vực/tháng nên làm sau, từ booking thật đã tổng hợp theo thời gian.
