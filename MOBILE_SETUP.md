# Tripio trên Web, Android và iOS

Frontend React/Vite được dùng chung cho website và hai project Capacitor. Backend ASP.NET Core và PostgreSQL/Neon vẫn là nguồn dữ liệu duy nhất.

## 0. Dùng trên điện thoại mà không bật laptop

Điện thoại chỉ hoạt động độc lập khi **frontend, backend và database đều chạy trên Internet**. Dự án đã có cấu hình production trỏ frontend đến backend HTTPS:

```text
https://booking-homestay-4ibv.onrender.com/api
```

Có thể triển khai frontend từ thư mục gốc repository bằng một trong hai cách:

- **Netlify:** file `netlify.toml` đã khai báo build, SPA fallback và cache cho PWA.
- **Vercel:** file `vercel.json` đã khai báo build và SPA rewrite.

Sau lần deploy đầu tiên, lấy URL frontend (ví dụ `https://tripio.netlify.app`) rồi đặt trên backend:

```env
CLIENT_URL=https://tripio.netlify.app
```

Nếu có nhiều frontend, khai báo thêm các origin, phân tách bằng dấu phẩy:

```env
CLIENT_URLS=https://tripio.vercel.app,https://www.tenmiencuaban.vn
```

Redeploy backend sau khi đổi CORS. Trên iPhone, mở URL HTTPS bằng Safari và chọn **Chia sẻ → Thêm vào Màn hình chính**. Trên Android, mở bằng Chrome và chọn **Cài đặt ứng dụng/Thêm vào màn hình chính**. Sau đó Tripio mở như ứng dụng và không cần laptop; các chức năng lấy dữ liệu vẫn cần Internet và backend phải đang hoạt động.

Không đặt `DATABASE_URL`, `JWT_SECRET`, khóa Supabase hay khóa VNPay trên Netlify/Vercel. Các giá trị đó chỉ nằm ở môi trường backend.

## 1. Cấu hình API

| Môi trường | File/lệnh | API mẫu |
|---|---|---|
| Web local | `.env.development` | `http://127.0.0.1:5000/api` |
| Android Emulator | `.env.mobile` | `http://10.0.2.2:5000/api` |
| Thiết bị thật | `.env.mobile` | `http://<IP-LAN>:5000/api` hoặc HTTPS |
| Production | `.env.production` | Backend HTTPS đã deploy |
| iOS Simulator | `.env.mobile` trên macOS | `http://localhost:5000/api` |

Không đưa `JWT_SECRET`, `DATABASE_URL`, TMN secret hoặc hash secret của VNPay vào frontend. Android chỉ cho phép HTTP cleartext trong debug; release yêu cầu HTTPS.

## 2. Chạy website

```powershell
cd frontend
npm install
npm run dev
```

Backend:

```powershell
cd backend
dotnet run
```

## 3. Đồng bộ Capacitor

```powershell
cd frontend
npm run mobile:sync
```

App ID: `com.tripio.homestay`. URL callback native đã đăng ký: `tripio://payment`.

## 4. Android

Yêu cầu: Java 17+, Android Studio và Android SDK Platform 36. Đặt `ANDROID_HOME` đúng thư mục SDK hoặc tạo `frontend/android/local.properties`:

```properties
sdk.dir=C:\\Users\\<user>\\AppData\\Local\\Android\\Sdk
```

Build APK debug:

```powershell
cd frontend
npm run mobile:build
```

APK sau khi build thành công:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Android Emulator gọi máy phát triển bằng `10.0.2.2`; thiết bị thật phải dùng IP LAN hoặc backend HTTPS. Thiết bị và máy phát triển cần cùng mạng, firewall phải cho phép cổng backend.

## 5. iOS

Source Xcode nằm trong `frontend/ios`. Windows có thể tạo và đồng bộ source nhưng không thể biên dịch/chạy iOS.

Trên macOS có Xcode:

```bash
cd frontend
npm install
npm run mobile:sync:ios
npx cap open ios
```

Trong Xcode: chọn Signing Team, chọn Simulator hoặc thiết bị, rồi Run. Để thử qua TestFlight: Product → Archive → Distribute App → App Store Connect → TestFlight. IPA/TestFlight bắt buộc macOS, Xcode và tài khoản Apple Developer.

## 6. Thanh toán VNPay

Website tiếp tục dùng chuyển hướng hiện tại. Android/iOS có đăng ký deep link `tripio://payment`; backend/cổng thanh toán chỉ nên chuyển về deep link này sau khi máy chủ đã xác minh callback. Không truyền kết quả “thành công” chỉ dựa trên query từ client.

## 7. Kiểm tra trước khi bàn giao

- `npm run build`
- `npm run build:mobile`
- `npx cap sync`
- `dotnet build --no-restore`
- Đăng nhập/đăng xuất, tìm và xem Homestay, đặt phòng, VNPay, Customer bookings, Host, Admin và AI.
- Kích thước: 375×667, 390×844, 412×915, 768×1024 và desktop; kiểm tra thêm landscape.
- Android: nút Back đóng modal/drawer trước khi thoát màn hình.
- Không có cuộn ngang toàn trang; modal/sheet không bị che bởi bàn phím hoặc safe area.
