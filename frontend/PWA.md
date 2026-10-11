# Cài Tripio lên màn hình chính iPhone

## Điều kiện

- Frontend phải được triển khai bằng HTTPS (ví dụ Vercel, Netlify hoặc Render).
- `VITE_API_URL` phải trỏ đến backend HTTPS đã triển khai, không dùng `localhost`.

## Cách cài trên iPhone

1. Mở địa chỉ Tripio bằng **Safari**.
2. Nhấn nút **Chia sẻ** (hình vuông có mũi tên hướng lên).
3. Chọn **Thêm vào Màn hình chính**.
4. Giữ tên **Tripio**, sau đó nhấn **Thêm**.

Tripio sẽ xuất hiện với biểu tượng riêng và mở ở chế độ toàn màn hình như một ứng dụng.

## Build để triển khai

```powershell
cd frontend
pnpm build
```

Thư mục cần đưa lên hosting là `frontend/dist`.
