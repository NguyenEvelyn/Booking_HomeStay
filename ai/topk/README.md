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
- Khi bắt đầu thanh toán, booking giữ mã phiên tìm kiếm hợp lệ trong 7 ngày. Chỉ sau khi VNPay xác nhận thành công, backend mới ghi một sự kiện `booking` gắn với `booking_id`; chỉ mục duy nhất bảo đảm callback VNPay lặp lại không làm trùng dữ liệu.
- `GET /api/recommendation-events/summary?days=30` dành cho Admin trả phễu tìm → xem → đặt, tỷ lệ đặt phòng, Recall@5 và NDCG@5 trong cửa sổ quy kết 7 ngày. Recall@5 cho biết tỷ lệ booking được quy kết có homestay nằm trong Top 5; NDCG@5 thưởng nhiều hơn khi homestay được đặt đứng ở thứ hạng cao. Khi lượng sự kiện còn ít, không nên dùng các tỷ lệ này để kết luận thuật toán tốt hơn.
- Top-K hiện dùng lượt xem thật trong 90 ngày của cùng phiên làm một phần nhỏ của tín hiệu hành vi (tối đa 3/10 điểm), còn booking đã xác nhận có trọng số lớn hơn. Khách mới vẫn nhận gợi ý theo giá, tiện nghi và đánh giá. Có thể đối chiếu số liệu Admin trước/sau thay đổi trọng số; cần thí nghiệm nhóm A/B để kết luận tác động nhân quả.

## Trạng thái pipeline học từ dữ liệu

1. Đã ghi sự kiện `booking` thật liên kết phiên và hiển thị chất lượng dữ liệu/quy mô mẫu trên Admin; hệ thống cần tiếp tục chạy để tích lũy đủ mẫu thật.
2. Đã dùng booking xác nhận làm tín hiệu mạnh, lượt xem làm tín hiệu nhẹ và tách tuyệt đối `source=real` khỏi dữ liệu demo `source=synthetic`.
3. Đã có pipeline chia tập theo **thời gian** và theo phiên/người dùng, so sánh Top-K với baseline giá thấp/đánh giá cao bằng Recall@5, NDCG@5, độ phủ homestay; tỷ lệ đặt phòng được báo cáo riêng như số liệu quan sát.
4. Đã có bước học trọng số, điều kiện quảng bá và fallback trong API. Việc còn lại là tích lũy đủ dữ liệu thật để báo cáo đạt ngưỡng tự động. Mô hình dự báo nhu cầu theo khu vực/tháng vẫn để sau, khi có nhiều tháng booking thật.

## Pipeline đánh giá và học trọng số

Admin có thể bấm **Xuất dữ liệu thật** trong khối thống kê gợi ý. API tương ứng là
`GET /api/recommendation-events/export?days=365`; chỉ Admin truy cập được và kết quả luôn có
`source=real`. Đặt file tải xuống ngoài Git hoặc trong `ai/topk/data/` với tên bắt đầu bằng
`real-events` (đã được `.gitignore` loại trừ), sau đó chạy:

```powershell
node ai/topk/evaluate-real.mjs ai/topk/data/real-events-2026-09-21.json
```

Script quy kết mỗi booking cho lượt tìm gần nhất trong cùng phiên, tối đa 7 ngày. Các mẫu được
gom theo khách; khách ẩn danh được gom theo phiên. Toàn bộ một nhóm chỉ nằm trong một tập, rồi
các nhóm được sắp theo thời gian để chia 60% train, 20% validation và 20% test. Báo cáo so sánh
Top-K đã hiển thị, baseline giá thấp, baseline đánh giá cao và trọng số được tìm trên train bằng
Recall@5, NDCG@5 và độ phủ homestay. Tỷ lệ đặt phòng là số liệu quan sát của hệ thống đang chạy;
không gán tỷ lệ phản thực tế cho các baseline khi chưa có A/B test.

Báo cáo được ghi vào `ai/topk/data/evaluation-report.json`. Mô hình chỉ được đánh dấu đủ điều kiện
khi có ít nhất 100 booking được quy kết (60/20/20), dùng hoàn toàn dữ liệu thật, và NDCG@5 của bộ
trọng số mới vượt cả hai baseline trên validation lẫn test. Khi backend khởi động, nó chỉ nạp trọng
số từ báo cáo đạt điều kiện này; nếu file thiếu, hỏng, chưa đủ mẫu hoặc không thắng baseline, API tự
động dùng baseline 40/30/20/10. Có thể đặt đường dẫn báo cáo bằng `RECOMMENDATION_MODEL_PATH`.
Response của `/api/recommendations` có `modelVersion` để kiểm tra phiên bản đang phục vụ.

Dữ liệu `demo-events.jsonl` vẫn chỉ dùng để kiểm thử đường ống. Pipeline trên từ chối file không có
`source=real`; không sử dụng số liệu demo để quảng bá mô hình hoặc báo cáo chất lượng thực tế.
