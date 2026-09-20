-- Đổi tên hiển thị của dữ liệu seed20; chỉ cập nhật tên placeholder còn nguyên.
-- Những homestay đã được chỉnh tên thủ công sẽ không bị thay đổi.
BEGIN;

WITH friendly(ordinal, display_name) AS (VALUES
  (1, 'Bãi Dừa Retreat Phú Quốc'),
  (2, 'Gió Nam Villa Sơn Trà'),
  (3, 'Mây Thông House Đà Lạt'),
  (4, 'Rừng Nhiệt Đới Lodge Nha Trang'),
  (5, 'Sóng Ngọc Stay Phú Quốc'),
  (6, 'Nắng Biển House Đà Nẵng'),
  (7, 'Đồi Sương Homestay Đà Lạt'),
  (8, 'Hòn Chồng Garden Stay'),
  (9, 'Cát Trắng Retreat Phú Quốc'),
  (10, 'Hải Vân Breeze Stay'),
  (11, 'Thông Xanh Villa Đà Lạt'),
  (12, 'Vịnh Nắng House Nha Trang'),
  (13, 'An Nhiên Bay Homestay'),
  (14, 'Biển Lam House Sơn Trà'),
  (15, 'Mộc Sương Homestay Đà Lạt'),
  (16, 'Mây Núi Retreat Nha Trang'),
  (17, 'Vườn Dừa Stay Phú Quốc'),
  (18, 'Ánh Dương Coastal House'),
  (19, 'Hoa Thông Homestay Đà Lạt'),
  (20, 'Biển Xanh Garden Home')
)
UPDATE homestays h
SET name = friendly.display_name, updated_at = CURRENT_TIMESTAMP
FROM friendly
WHERE h.name = 'Seed20 Homestay ' || lpad(friendly.ordinal::text, 2, '0');

WITH friendly(ordinal, display_name) AS (VALUES
  (1, 'Nguyễn Minh Anh'), (2, 'Trần Quốc Bảo'),
  (3, 'Lê Hà My'), (4, 'Phạm Gia Huy')
)
UPDATE users u
SET full_name = friendly.display_name, updated_at = CURRENT_TIMESTAMP
FROM friendly
WHERE u.email = 'seed20.host' || friendly.ordinal || '@tripio.demo'
  AND u.full_name = 'Chủ nhà mẫu ' || friendly.ordinal;

WITH friendly(ordinal, display_name) AS (VALUES
  (1, 'Nguyễn Thu Hà'), (2, 'Trần Minh Khang'), (3, 'Lê Phương Linh'),
  (4, 'Phạm Đức Anh'), (5, 'Hoàng Bảo Ngọc'), (6, 'Vũ Thanh Tùng'),
  (7, 'Đỗ Ngọc Mai'), (8, 'Bùi Quang Huy'), (9, 'Nguyễn Khánh Vy'),
  (10, 'Trần Gia Bảo'), (11, 'Lê Minh Châu'), (12, 'Phạm Ngọc Hân'),
  (13, 'Hoàng Anh Tuấn'), (14, 'Vũ Thảo Nhi'), (15, 'Đỗ Thành Đạt'),
  (16, 'Bùi Mai Anh'), (17, 'Nguyễn Nhật Minh'), (18, 'Trần Hương Giang'),
  (19, 'Lê Quốc Khánh'), (20, 'Phạm Thanh Trúc')
)
UPDATE users u
SET full_name = friendly.display_name, updated_at = CURRENT_TIMESTAMP
FROM friendly
WHERE u.email = 'seed20.customer' || friendly.ordinal || '@tripio.demo'
  AND u.full_name = 'Khách hàng mẫu ' || lpad(friendly.ordinal::text, 2, '0');

COMMIT;
