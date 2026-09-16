# Hệ thống Quản lý và Đặt phòng Homestay

Ứng dụng gồm Backend ASP.NET Core Web API, Frontend React và SQL Server. Dự án được tổ chức theo kiến trúc modular monolith để phát triển lần lượt các nghiệp vụ Auth, Homestay, Room, Booking, Payment và Administration.

Chi tiết cách đặt mã và mở rộng module xem tại [`docs/architecture.md`](docs/architecture.md).

## Cấu trúc chính

```text
backend/       ASP.NET Core Web API
frontend/      React + Vite
database/      Script khởi tạo SQL Server
docs/          Tài liệu yêu cầu và kiến trúc
```

## Yêu cầu môi trường

- .NET SDK 9
- Node.js và npm hoặc pnpm
- PostgreSQL trên Neon đã chạy [`database/init.sql`](database/init.sql)

## Cấu hình sau khi clone

Các file `.env` chứa thông tin riêng của từng máy nên không được đưa lên GitHub.
Sau khi clone, tạo chúng từ các file mẫu:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Mở `backend/.env` và điền chuỗi kết nối PostgreSQL. Khi deploy, không cần upload
file `.env`: chỉ tạo secret/biến môi trường này trong phần cấu hình của backend cloud.

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

DATABASE_URL=postgresql://your_user:your_password@your-host/neondb?sslmode=require

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_HOURS=24
COOKIE_MAX_AGE_MS=86400000
```

Không ghi mật khẩu thật vào `.env.example` và không commit file `.env`.

Biến `DATABASE_URL` được ưu tiên. Backend chỉ đọc biến này; frontend không bao
giờ nhận thông tin database. Dùng chuỗi pooled connection từ Neon khi deploy.

Nội dung `frontend/.env` khi chạy trên máy cá nhân:

```env
VITE_API_URL=http://localhost:5000/api
```

## Chạy dự án

### 1. Chạy backend

Mở terminal thứ nhất:

```powershell
cd backend
dotnet restore
dotnet run
```

Kiểm tra backend tại http://localhost:5000/api/health. Kết quả mong đợi:

```json
{"status":"ok"}
```

### 2. Chạy frontend

Mở terminal thứ hai tại thư mục gốc dự án:

```powershell
cd frontend
npm install
npm run dev
```

Nếu sử dụng pnpm:

```powershell
cd frontend
pnpm install
pnpm dev
```

Mở ứng dụng tại http://localhost:5173.

Luồng kết nối của hệ thống:

```text
React frontend → ASP.NET Core API → PostgreSQL (Neon)
```

Frontend không kết nối trực tiếp và không được chứa tài khoản hoặc mật khẩu PostgreSQL.

## Lỗi kết nối Neon/PostgreSQL thường gặp

- `Thiếu biến môi trường ...`: kiểm tra file `backend/.env` và chạy lại backend.
- Lỗi kết nối: kiểm tra lại toàn bộ `DATABASE_URL` từ Neon, đặc biệt mật khẩu và `SSL Mode=Require`.
- Sau khi đổi `.env`, phải dừng và chạy lại backend hoặc frontend.

## API xác thực

- `POST /api/auth/register` — đăng ký tài khoản.
- `POST /api/auth/login` — đăng nhập và nhận cookie HttpOnly.
- `GET /api/auth/me` — kiểm tra phiên đăng nhập.
- `POST /api/auth/logout` — xóa cookie và đăng xuất.
- `POST /api/auth/forgot-password` — gửi OTP đặt lại mật khẩu qua email.
- `POST /api/auth/reset-password` — xác minh OTP và tạo mật khẩu mới.
- `POST /api/auth/change-password` — đổi mật khẩu khi đang đăng nhập.
- `GET /api/auth/external/google` — bắt đầu đăng nhập Google.
- `GET /api/auth/external/facebook` — bắt đầu đăng nhập Facebook.

## Cấu hình Google và Facebook OAuth

Tạo OAuth app ở Google Cloud Console và Meta for Developers, sau đó điền bốn
biến sau trong `backend/.env` (không commit file này):

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```

Khai báo callback URL trong trang quản trị của từng nhà cung cấp:

- Google: `http://localhost:5000/signin-google`
- Facebook: `http://localhost:5000/signin-facebook`

Khi deploy, thay `localhost:5000` bằng domain HTTPS của backend.

## Vai trò và phân quyền

- `Customer`: khách thuê, được đăng ký công khai.
- `Host`: chủ homestay, được đăng ký công khai.
- `Admin`: quản trị viên, không được tự đăng ký; chỉ cấp trong database.
- Backend đưa vai trò vào JWT. Với controller mới, dùng `[Authorize(Roles = "Host,Admin")]`
  hoặc `[Authorize(Roles = "Admin")]` để giới hạn API.
