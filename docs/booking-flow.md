# Luồng đặt phòng Tripio

1. Khách chọn địa điểm, ngày nhận và trả, tổng số khách và số phòng. Danh sách chỉ hiển thị homestay có ít nhất một loại phòng đủ sức chứa và đủ số phòng trong **toàn bộ** khoảng ngày này. Đơn chỉ nhận ngày nhận từ hôm nay theo giờ Việt Nam và ít nhất một đêm.
2. Ở trang chi tiết, nút **Kiểm tra phòng** tải lại khả dụng theo ngày và số khách. Số phòng vật lý được tính theo từng phòng: phòng đã được gán cho đơn chồng ngày sẽ không xuất hiện, dù có nhiều đơn ở các ngày khác nhau. Đơn cũ chưa gán phòng được trừ bảo thủ vào số phòng còn lại.
3. Khách chọn loại phòng, số khách và số phòng. `POST /api/bookings/quote` kiểm tra lại ngày, sức chứa, tồn phòng và tính tổng tiền theo giá từng đêm. Phụ thu dựa trên số khách vượt sức chứa cơ bản; báo giá từ server là số tiền dùng để thanh toán.
4. Khi khách yêu cầu thanh toán, backend khóa loại phòng, kiểm tra lại tồn và tạo đơn `PendingPayment` trong giao dịch. Phòng được giữ 15 phút tính từ `UpdatedAt` của đơn. Một lần thử thanh toán mới tạo mã giao dịch mới và bắt đầu mốc giữ phòng mới; thời gian tạo đơn gốc không thay đổi.
5. VNPay return và IPN dùng cùng quy tắc xử lý, khóa từng đơn và chỉ xác nhận lần thanh toán thuộc lượt giữ phòng hiện tại. Callback lặp lại không đổi trạng thái. Tiền về sau khi hết giữ phòng hoặc sau khi đơn đổi trạng thái được ghi nhận và tạo khoản hoàn `Pending` để đối soát; phòng không bị chiếm lại.
6. Đơn `Confirmed`, `CheckedIn` và `CancellationRequested` vẫn giữ phòng đến khi kết thúc hoặc hủy được duyệt. Khách hủy đơn đã thanh toán sẽ gửi yêu cầu cho Host. Host duyệt thì đơn thành `Cancelled`; nếu cần hoàn tiền, một giao dịch hoàn `Pending` được tạo. Bản hiện tại **chưa tự gọi API hoàn tiền VNPay** nên Host cần xử lý và đối soát khoản này.
7. Host chỉ được nhận phòng trong ngày lưu trú khi phòng ở trạng thái `Available`. Sau khi hoàn tất lưu trú, phòng chuyển sang `Cleaning` và cần được chủ nhà đưa về `Available` trước khi nhận lượt khách tiếp theo.

Các điểm cần quyết định thêm trước khi mở rộng: quy tắc trả phòng muộn, xử lý khách không đến, thời điểm tự động đánh dấu hoàn tất và quy trình hoàn tiền thật qua VNPay.
