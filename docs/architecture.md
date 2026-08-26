# Kiến trúc dự án

Ứng dụng sử dụng kiến trúc modular monolith. Mỗi nghiệp vụ nằm trong một module riêng, nhưng toàn bộ backend vẫn được triển khai dưới dạng một API và dùng chung một cơ sở dữ liệu.

## Backend

```text
backend/
├── Domain/
│   └── Entities/               # Thực thể dùng chung và ánh xạ dữ liệu
├── Features/
│   ├── Auth/                   # Đăng ký, đăng nhập, phiên người dùng
│   ├── Homestays/              # Quản lý và kiểm duyệt homestay
│   ├── Rooms/                  # Phòng, giá và lịch trống
│   ├── Bookings/               # Đặt phòng, hủy, nhận/trả phòng
│   ├── Payments/               # Thanh toán và hoàn tiền giả lập
│   └── Administration/         # Quản trị người dùng và báo cáo
├── Infrastructure/
│   └── Persistence/            # DbContext, cấu hình Entity Framework
├── Utilities/                  # Tiện ích kỹ thuật dùng chung
└── Program.cs                  # Cấu hình và khởi động ứng dụng
```

Mỗi thư mục trong `Features` có thể chứa `Controllers`, `DTOs`, `Services` và `Validators`. Chỉ tạo thư mục khi module thực sự cần, không tạo lớp rỗng để dự phòng.

## Frontend

```text
frontend/src/
├── app/                        # Component gốc, router và provider toàn cục
├── features/
│   ├── auth/
│   ├── homestays/
│   ├── rooms/
│   ├── bookings/
│   ├── payments/
│   └── administration/
├── shared/
│   ├── api/                    # HTTP client dùng chung
│   ├── components/             # Thành phần giao diện dùng ở nhiều module
│   ├── hooks/
│   └── utils/
├── main.jsx
└── styles.css
```

Trong mỗi tính năng frontend có thể tạo `api`, `components`, `pages`, `hooks` và `utils`. Thành phần chỉ dùng trong một tính năng phải nằm trong tính năng đó; chỉ chuyển sang `shared` khi được ít nhất hai tính năng sử dụng.

## Quy tắc phụ thuộc

- Controller chỉ tiếp nhận yêu cầu, gọi service và trả phản hồi HTTP.
- Service chứa quy tắc nghiệp vụ và điều phối thao tác dữ liệu.
- DTO là hợp đồng đầu vào/đầu ra; không trả Entity trực tiếp từ API.
- Entity không phụ thuộc Controller, DTO hoặc giao diện.
- `Infrastructure` triển khai truy cập dữ liệu và không chứa quy tắc nghiệp vụ.
- Module không truy cập trực tiếp controller hoặc component nội bộ của module khác.
- Frontend gọi API thông qua `shared/api/apiClient.js`.

## Module triển khai theo thứ tự

1. Auth
2. Homestays
3. Rooms
4. Administration - kiểm duyệt homestay
5. Bookings
6. Payments
7. Administration - giám sát và báo cáo
