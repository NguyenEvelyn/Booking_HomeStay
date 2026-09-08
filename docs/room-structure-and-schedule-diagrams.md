# Sơ đồ quản lý cấu trúc phòng và lịch phòng

## 1. Sơ đồ kiến trúc 3 lớp

```mermaid
flowchart TB
    Host[Chủ homestay]

    subgraph L1["Lớp trình bày — Presentation Layer"]
        RoomUI[Trang quản lý loại phòng và phòng]
        CalendarUI[Trang lịch phòng]
        ApiClient[API Client]
        RoomUI --> ApiClient
        CalendarUI --> ApiClient
    end

    subgraph L2["Lớp nghiệp vụ — Business Layer"]
        RoomController[Rooms Controller]
        RoomService[Room Service]
        ScheduleService[Room Schedule Service]
        Validator[Validator và kiểm tra quyền Host]

        RoomController --> Validator
        RoomController --> RoomService
        RoomController --> ScheduleService
        RoomService -->|kiểm tra trùng số phòng| ScheduleService
    end

    subgraph L3["Lớp dữ liệu — Data Access Layer"]
        DbContext[AppDbContext / Repository]
        Homestays[(homestays)]
        RoomTypes[(room_types)]
        Rooms[(rooms)]
        Bookings[(bookings)]
        BookingDetails[(booking_details)]

        DbContext --> Homestays
        DbContext --> RoomTypes
        DbContext --> Rooms
        DbContext --> Bookings
        DbContext --> BookingDetails
    end

    Host --> RoomUI
    Host --> CalendarUI
    ApiClient -->|HTTPS / JSON| RoomController
    RoomService --> DbContext
    ScheduleService --> DbContext
```

### Trách nhiệm từng lớp

- **Presentation Layer:** nhận thao tác của Host, hiển thị loại phòng, phòng vật lý và lịch theo ngày.
- **Business Layer:** xác thực dữ liệu, kiểm tra quyền sở hữu homestay, kiểm tra trùng số phòng và xác định trạng thái phòng theo lịch đặt.
- **Data Access Layer:** đọc/ghi `room_types`, `rooms`; kết hợp `bookings` và `booking_details` để tạo lịch phòng.

## 2. Sequence quản lý cấu trúc phòng

Luồng dưới đây áp dụng cho thao tác thêm hoặc cập nhật loại phòng và các phòng vật lý thuộc loại phòng đó.

```mermaid
sequenceDiagram
    autonumber
    actor Host as Chủ homestay
    participant UI as Giao diện quản lý phòng
    participant API as Rooms Controller
    participant Service as Room Service
    participant DB as Cơ sở dữ liệu

    Host->>UI: Nhập thông tin loại phòng/phòng
    UI->>UI: Kiểm tra trường bắt buộc
    UI->>API: Gửi yêu cầu lưu
    API->>Service: Chuyển DTO và thông tin người dùng
    Service->>DB: Kiểm tra Host sở hữu homestay
    DB-->>Service: Kết quả quyền sở hữu

    alt Không có quyền
        Service-->>API: Từ chối truy cập
        API-->>UI: 403 Forbidden
        UI-->>Host: Thông báo không có quyền
    else Có quyền
        Service->>Service: Kiểm tra giá, sức chứa, trạng thái
        Service->>DB: Kiểm tra tên loại phòng/số phòng trùng

        alt Dữ liệu không hợp lệ hoặc bị trùng
            DB-->>Service: Phát hiện xung đột
            Service-->>API: Lỗi nghiệp vụ
            API-->>UI: 400/409 và nội dung lỗi
            UI-->>Host: Hiển thị lỗi cần sửa
        else Hợp lệ
            Service->>DB: Bắt đầu giao dịch
            Service->>DB: Lưu room_types
            Service->>DB: Thêm/cập nhật rooms
            Service->>DB: Hoàn tất giao dịch
            DB-->>Service: Dữ liệu đã lưu
            Service-->>API: DTO kết quả
            API-->>UI: 200/201 Success
            UI-->>Host: Cập nhật danh sách phòng
        end
    end
```

## 3. Sequence xem lịch phòng

Lịch được tổng hợp từ phòng vật lý, trạng thái phòng và các đặt phòng đang có hiệu lực; không cần lưu một bản lịch trùng lặp.

```mermaid
sequenceDiagram
    autonumber
    actor Host as Chủ homestay
    participant UI as Giao diện lịch phòng
    participant API as Rooms Controller
    participant Service as Room Schedule Service
    participant DB as Cơ sở dữ liệu

    Host->>UI: Chọn homestay và khoảng ngày
    UI->>API: GET lịch phòng từ ngày đến ngày
    API->>Service: Yêu cầu lấy lịch
    Service->>Service: Kiểm tra khoảng ngày hợp lệ
    Service->>DB: Kiểm tra quyền sở hữu homestay

    alt Không có quyền
        DB-->>Service: Không thuộc Host
        Service-->>API: Từ chối truy cập
        API-->>UI: 403 Forbidden
    else Có quyền
        DB-->>Service: Xác nhận quyền sở hữu
        Service->>DB: Lấy room_types và rooms
        Service->>DB: Lấy booking_details nối bookings
        Note over Service,DB: Chỉ lấy booking có trạng thái<br/>PendingPayment, Confirmed hoặc CheckedIn<br/>và giao với khoảng ngày yêu cầu
        DB-->>Service: Phòng và các khoảng thời gian đã đặt
        Service->>Service: Tổng hợp từng ngày: Trống / Đã đặt / Đang ở / Bảo trì / Ngưng hoạt động
        Service-->>API: RoomScheduleDto
        API-->>UI: 200 và dữ liệu lịch
        UI-->>Host: Hiển thị lịch theo phòng và ngày
    end
```

## 4. Sequence cập nhật trạng thái vận hành phòng

```mermaid
sequenceDiagram
    autonumber
    actor Host as Chủ homestay
    participant UI as Giao diện lịch phòng
    participant API as Rooms Controller
    participant Service as Room Service
    participant DB as Cơ sở dữ liệu

    Host->>UI: Chọn phòng và trạng thái mới
    UI->>API: PATCH trạng thái phòng
    API->>Service: Cập nhật Available/Cleaning/Maintenance/Inactive
    Service->>DB: Kiểm tra quyền sở hữu và dữ liệu phòng
    Service->>DB: Kiểm tra đặt phòng bị ảnh hưởng

    alt Có đặt phòng hiệu lực xung đột
        DB-->>Service: Có booking bị ảnh hưởng
        Service-->>API: 409 Conflict
        API-->>UI: Yêu cầu xử lý đặt phòng trước
        UI-->>Host: Hiển thị booking xung đột
    else Không xung đột
        Service->>DB: Cập nhật rooms.status
        DB-->>Service: Cập nhật thành công
        Service-->>API: Trạng thái mới
        API-->>UI: 200 Success
        UI-->>Host: Làm mới lịch phòng
    end
```

## Quy tắc nghiệp vụ chính

1. Một `homestay` có nhiều `room_types`; một `room_type` có nhiều `rooms`.
2. Tên loại phòng không được trùng trong cùng homestay.
3. Số phòng không được trùng trong cùng loại phòng.
4. Khoảng lưu trú dùng quy tắc nửa mở `[check_in_date, check_out_date)`: ngày trả phòng có thể là ngày nhận của lượt tiếp theo.
5. Một phòng không được có hai booking hiệu lực giao nhau.
6. Phòng `Maintenance` hoặc `Inactive` không được phân bổ cho booking mới.
7. Mọi thao tác sửa cấu trúc hoặc trạng thái phòng phải kiểm tra người dùng là Host sở hữu homestay.
