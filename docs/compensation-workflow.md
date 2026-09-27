# Quy trình bồi thường

Backend tách quy trình thành ba phần: danh mục tài sản, hồ sơ bồi thường và khoản phải thu. Host chủ động lập hồ sơ và mức tiền; `AdditionalCharge` chỉ được tạo sau khi Customer xác nhận.

## Luồng trạng thái

```text
Draft -> PendingConfirmation -> PaymentPending -> Paid
                            \-> Withdrawn (Host thu hồi)
```

- Hồ sơ gửi cho khách phải có ít nhất một ảnh, video hoặc tài liệu chứng minh.
- Mỗi dòng thiệt hại snapshot tên tài sản, giá, khấu hao và mức yêu cầu tại thời điểm tạo.
- Mức yêu cầu bằng `số lượng × đơn giá × (100% - khấu hao)`, không vượt mức tối đa của danh mục.
- Khách có 48 giờ để xác nhận. Backend trả `responseDueAt` để giao diện hiển thị hạn và hệ thống nhắc việc sau này.
- Khách không chỉnh sửa số tiền và không mở tranh chấp trong quy trình rút gọn này.
- Host có thể thu hồi hồ sơ trước khi khách xác nhận. Mọi hành động quan trọng đều ghi `audit_logs`.
- Khi khoản `AdditionalCharge` đã thanh toán, API đọc hồ sơ hiển thị trạng thái hiệu dụng `Paid`.

## API dành cho Host

- `GET /api/host/homestays/{homestayId}/compensation-catalog`
- `POST /api/host/homestays/{homestayId}/compensation-catalog`
- `PUT /api/host/compensation-catalog/{id}`
- `DELETE /api/host/compensation-catalog/{id}` — ngừng áp dụng, không xóa lịch sử.
- `GET /api/compensation-claims?status=&bookingId=`
- `GET /api/compensation-claims/{id}`
- `POST /api/host/compensation-claims`
- `DELETE /api/host/compensation-claims/{id}` — chỉ hồ sơ nháp.
- `POST /api/host/compensation-claims/{id}/submit`
- `POST /api/host/compensation-claims/{id}/withdraw`

## API dành cho Customer

- `GET /api/homestays/{homestayId}/compensation-catalog` — công khai để xem điều khoản trước khi đặt.
- `GET /api/compensation-claims?status=&bookingId=`
- `GET /api/compensation-claims/{id}`
- `POST /api/compensation-claims/{id}/accept`

## Giao diện Host cần xây sau này

1. **Danh mục bồi thường:** bảng tài sản theo homestay, nhóm, đơn vị, giá thay thế, mức tối đa, tỷ lệ khấu hao và trạng thái áp dụng.
2. **Checklist/biên bản sự cố theo booking:** chọn tài sản, mức độ hư hỏng, số lượng, ghi chú và tải bằng chứng.
3. **Xem trước hồ sơ:** hiển thị công thức và tổng tiền trước khi gửi khách.
4. **Danh sách hồ sơ:** bộ lọc theo trạng thái, booking, hạn phản hồi và tổng tiền.
5. **Chi tiết hồ sơ:** bằng chứng, trạng thái xác nhận và thao tác thu hồi trước khi khách xác nhận.
6. **Việc cần xử lý:** hồ sơ nháp, hồ sơ bị khiếu nại, khoản đã chốt nhưng chưa thanh toán.

## Giao diện Customer cần xây sau này

1. **Điều khoản bồi thường:** danh mục giá áp dụng của homestay trước khi xác nhận booking.
2. **Thông báo yêu cầu mới:** số tiền, hạn phản hồi và đường dẫn mở hồ sơ.
3. **Chi tiết hồ sơ:** booking, tài sản, cách tính, ảnh/video, mô tả và lịch sử quyết định.
4. **Xác nhận:** Customer xác nhận mức bồi thường do Host gửi.
5. **Thanh toán:** khoản đã chốt xuất hiện cùng công nợ booking, không nằm trong hồ sơ cáo buộc chưa xác minh.
6. **Lịch sử:** hồ sơ đang chờ xác nhận, chờ thanh toán, đã thanh toán hoặc được Host thu hồi.

## Triển khai cơ sở dữ liệu

Chạy `database/migrations/20260925_compensation_workflow.sql` trên PostgreSQL trước khi sử dụng các API mới.
