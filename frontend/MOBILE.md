# Tripio Mobile (Capacitor Android)

Ứng dụng mobile dùng chung frontend React/Vite và backend ASP.NET Core với website.

## Cấu hình API

Sao chép `.env.mobile.example` thành `.env.mobile` và đặt `VITE_API_URL` thành
địa chỉ HTTPS của backend đã deploy. Thiết bị thật không thể truy cập backend
trên máy tính qua `localhost`.

Ví dụ khi dùng backend trong mạng LAN:

```env
VITE_API_URL=http://192.168.1.10:5000/api
```

Với Android Emulator, địa chỉ máy phát triển thường là `10.0.2.2`:

```env
VITE_API_URL=http://10.0.2.2:5000/api
```

## Đồng bộ mã web vào Android

```powershell
pnpm mobile:sync
```

Chạy lại lệnh này sau mỗi lần thay đổi frontend trước khi build native.

## Mở trong Android Studio

```powershell
pnpm mobile:open
```

## Build APK debug

```powershell
pnpm mobile:build
```

APK được tạo tại `android/app/build/outputs/apk/debug/app-debug.apk`.

## Yêu cầu máy phát triển

- Node.js 22 trở lên.
- Java 17.
- Android Studio và Android SDK Platform 36.
- `ANDROID_HOME` hoặc `local.properties` phải trỏ đến Android SDK tồn tại.

Khi phát hành, dùng backend HTTPS và không bật cleartext HTTP cho bản production.
