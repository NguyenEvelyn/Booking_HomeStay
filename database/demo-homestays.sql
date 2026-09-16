-- Dữ liệu Homestay mẫu dành cho Neon/PostgreSQL.
-- Yêu cầu: đã tồn tại các bảng homestays, amenities,
-- homestay_amenities và homestay_images.

BEGIN;

-- Tài khoản Host mẫu. Mật khẩu: Demo@123
INSERT INTO users (
  full_name, email, phone_number, password_hash, role, status,
  email_verified_at, created_at, updated_at
)
VALUES (
  'Trần Hoàng Chủ Nhà',
  'host@tripio.demo',
  '0900000002',
  'VpCx1bLpNi4lpeWoC6HhOA==.cQaJxLl1O1J9UNqM+JVeJCmwhpL0/dqZ51iQONmavsQ=',
  'Host', 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE SET
  role = 'Host',
  status = 'Active',
  email_verified_at = COALESCE(users.email_verified_at, CURRENT_TIMESTAMP),
  updated_at = CURRENT_TIMESTAMP;

-- Chỉ thêm homestay chưa tồn tại của Host mẫu.
INSERT INTO homestays (
  host_id, name, description, address_line, ward, district, province,
  latitude, longitude, check_in_time, check_out_time, status
)
SELECT
  u.user_id,
  h.name,
  h.description,
  h.address_line,
  h.ward,
  h.district,
  h.province,
  h.latitude,
  h.longitude,
  h.check_in_time,
  h.check_out_time,
  h.status
FROM users u
CROSS JOIN (
  VALUES
    (
      'Tripio Sunset Phú Quốc',
      'Homestay gần biển với không gian yên tĩnh, phòng có ban công và khu vực ngắm hoàng hôn.',
      '118 Đường Trần Hưng Đạo', 'Dương Đông', 'Phú Quốc', 'Kiên Giang',
      10.1980000::NUMERIC, 103.9670000::NUMERIC,
      TIME '14:00', TIME '12:00', 'Approved'
    ),
    (
      'Tripio Azure Đà Nẵng',
      'Không gian nghỉ dưỡng hiện đại gần biển Mỹ Khê, phù hợp cho gia đình và nhóm bạn.',
      '86 Đường Võ Nguyên Giáp', 'Phước Mỹ', 'Sơn Trà', 'Đà Nẵng',
      16.0642000::NUMERIC, 108.2441000::NUMERIC,
      TIME '14:00', TIME '11:30', 'Approved'
    ),
    (
      'Tripio Pine Đà Lạt',
      'Căn nhà gỗ giữa đồi thông, có sân vườn, bếp chung và không gian đốt lửa ngoài trời.',
      '25 Đường Hoa Hồng', 'Phường 4', 'Đà Lạt', 'Lâm Đồng',
      11.9215000::NUMERIC, 108.4310000::NUMERIC,
      TIME '13:30', TIME '11:00', 'Pending'
    )
) AS h(name, description, address_line, ward, district, province, latitude, longitude, check_in_time, check_out_time, status)
WHERE u.email = 'host@tripio.demo'
  AND NOT EXISTS (
    SELECT 1
    FROM homestays existing
    WHERE existing.host_id = u.user_id
      AND existing.name = h.name
  );

INSERT INTO amenities (name, icon_url, category, description)
VALUES
  ('Wi-Fi miễn phí', NULL, 'Internet', 'Wi-Fi miễn phí trong toàn bộ khuôn viên'),
  ('Máy lạnh', NULL, 'Phòng', 'Máy lạnh riêng trong phòng'),
  ('Bãi đỗ xe', NULL, 'Dịch vụ', 'Khu vực đỗ xe dành cho khách'),
  ('Hồ bơi', NULL, 'Giải trí', 'Hồ bơi sử dụng chung'),
  ('Bếp chung', NULL, 'Tiện ích', 'Bếp và dụng cụ nấu ăn dùng chung')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- Gắn tiện nghi phù hợp cho từng homestay.
INSERT INTO homestay_amenities (homestay_id, amenity_id)
SELECT h.homestay_id, a.amenity_id
FROM homestays h
JOIN users u ON u.user_id = h.host_id
JOIN amenities a ON
  (h.name = 'Tripio Sunset Phú Quốc' AND a.name IN ('Wi-Fi miễn phí', 'Máy lạnh', 'Bãi đỗ xe', 'Hồ bơi'))
  OR (h.name = 'Tripio Azure Đà Nẵng' AND a.name IN ('Wi-Fi miễn phí', 'Máy lạnh', 'Bãi đỗ xe'))
  OR (h.name = 'Tripio Pine Đà Lạt' AND a.name IN ('Wi-Fi miễn phí', 'Bãi đỗ xe', 'Bếp chung'))
WHERE u.email = 'host@tripio.demo'
ON CONFLICT (homestay_id, amenity_id) DO NOTHING;

-- Ảnh mẫu công khai; mỗi homestay chỉ có một ảnh đại diện.
INSERT INTO homestay_images (homestay_id, image_url, caption, is_thumbnail, sort_order)
SELECT h.homestay_id, image.image_url, image.caption, TRUE, 0
FROM homestays h
JOIN users u ON u.user_id = h.host_id
JOIN (
  VALUES
    ('Tripio Sunset Phú Quốc', 'https://images.unsplash.com/photo-1601918774946-25832a4be0d6', 'Không gian nghỉ dưỡng gần biển'),
    ('Tripio Azure Đà Nẵng', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6', 'Khu nghỉ dưỡng hiện đại'),
    ('Tripio Pine Đà Lạt', 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8', 'Nhà gỗ giữa thiên nhiên')
) AS image(homestay_name, image_url, caption) ON image.homestay_name = h.name
WHERE u.email = 'host@tripio.demo'
  AND NOT EXISTS (
    SELECT 1 FROM homestay_images existing
    WHERE existing.homestay_id = h.homestay_id AND existing.is_thumbnail
  );

-- Loại phòng mẫu cho hai homestay đã được duyệt.
INSERT INTO room_types (
  homestay_id, name, description, base_price, max_adults, max_children,
  bed_type, room_size, status
)
SELECT h.homestay_id, rt.name, rt.description, rt.base_price, rt.max_adults,
       rt.max_children, rt.bed_type, rt.room_size, 'Active'
FROM homestays h
JOIN users u ON u.user_id = h.host_id
JOIN (
  VALUES
    ('Tripio Sunset Phú Quốc', 'Deluxe hướng biển', 'Phòng có ban công nhìn ra biển và giường cỡ lớn.', 1456000::NUMERIC, 2, 1, 'King', 32::NUMERIC),
    ('Tripio Sunset Phú Quốc', 'Family Suite', 'Phòng gia đình rộng rãi gồm hai giường và khu vực sinh hoạt.', 2290000::NUMERIC, 4, 2, '2 Queen', 52::NUMERIC),
    ('Tripio Azure Đà Nẵng', 'Superior Double', 'Phòng đôi hiện đại, phù hợp cho chuyến nghỉ dưỡng ngắn ngày.', 1156000::NUMERIC, 2, 1, 'Queen', 28::NUMERIC),
    ('Tripio Azure Đà Nẵng', 'Azure Family', 'Phòng gia đình gần biển với không gian sinh hoạt riêng.', 1980000::NUMERIC, 4, 2, '2 Queen', 48::NUMERIC)
) AS rt(homestay_name, name, description, base_price, max_adults, max_children, bed_type, room_size)
  ON rt.homestay_name = h.name
WHERE u.email = 'host@tripio.demo'
  AND NOT EXISTS (
    SELECT 1 FROM room_types existing
    WHERE existing.homestay_id = h.homestay_id AND existing.name = rt.name
  );

-- Các phòng vật lý dùng để tính số lượng phòng đang trống.
INSERT INTO rooms (room_type_id, room_number, floor_number, status, note)
SELECT rt.room_type_id, room.room_number, room.floor_number, room.status, NULL
FROM room_types rt
JOIN homestays h ON h.homestay_id = rt.homestay_id
JOIN users u ON u.user_id = h.host_id
JOIN (
  VALUES
    ('Deluxe hướng biển', 'P201', 2, 'Available'),
    ('Deluxe hướng biển', 'P202', 2, 'Available'),
    ('Deluxe hướng biển', 'P203', 2, 'Maintenance'),
    ('Family Suite', 'P301', 3, 'Available'),
    ('Family Suite', 'P302', 3, 'Available'),
    ('Superior Double', 'A101', 1, 'Available'),
    ('Superior Double', 'A102', 1, 'Cleaning'),
    ('Azure Family', 'A201', 2, 'Available'),
    ('Azure Family', 'A202', 2, 'Available')
) AS room(room_type_name, room_number, floor_number, status)
  ON room.room_type_name = rt.name
WHERE u.email = 'host@tripio.demo'
ON CONFLICT (room_type_id, room_number) DO UPDATE SET
  floor_number = EXCLUDED.floor_number,
  status = EXCLUDED.status,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO room_type_amenities (room_type_id, amenity_id)
SELECT rt.room_type_id, a.amenity_id
FROM room_types rt
JOIN homestays h ON h.homestay_id = rt.homestay_id
JOIN users u ON u.user_id = h.host_id
JOIN amenities a ON a.name IN ('Wi-Fi miễn phí', 'Máy lạnh')
WHERE u.email = 'host@tripio.demo'
ON CONFLICT (room_type_id, amenity_id) DO NOTHING;

INSERT INTO room_type_images (room_type_id, image_url, caption, is_thumbnail, sort_order)
SELECT rt.room_type_id, image.image_url, image.caption, TRUE, 0
FROM room_types rt
JOIN homestays h ON h.homestay_id = rt.homestay_id
JOIN users u ON u.user_id = h.host_id
JOIN (
  VALUES
    ('Deluxe hướng biển', 'https://images.unsplash.com/photo-1611892440504-42a792e24d32', 'Phòng Deluxe hướng biển'),
    ('Family Suite', 'https://images.unsplash.com/photo-1591088398332-8a7791972843', 'Không gian Family Suite'),
    ('Superior Double', 'https://images.unsplash.com/photo-1618773928121-c32242e63f39', 'Phòng Superior Double'),
    ('Azure Family', 'https://images.unsplash.com/photo-1590490360182-c33d57733427', 'Phòng Azure Family')
) AS image(room_type_name, image_url, caption) ON image.room_type_name = rt.name
WHERE u.email = 'host@tripio.demo'
  AND NOT EXISTS (
    SELECT 1 FROM room_type_images existing
    WHERE existing.room_type_id = rt.room_type_id AND existing.is_thumbnail
  );

COMMIT;

-- Kết quả kiểm tra sau khi thêm dữ liệu.
SELECT
  h.homestay_id,
  h.name,
  h.district,
  h.province,
  h.status,
  u.email AS host_email,
  COUNT(DISTINCT ha.amenity_id) AS amenity_count,
  COUNT(DISTINCT hi.image_id) AS image_count
FROM homestays h
JOIN users u ON u.user_id = h.host_id
LEFT JOIN homestay_amenities ha ON ha.homestay_id = h.homestay_id
LEFT JOIN homestay_images hi ON hi.homestay_id = h.homestay_id
WHERE u.email = 'host@tripio.demo'
GROUP BY h.homestay_id, h.name, h.district, h.province, h.status, u.email
ORDER BY h.homestay_id;

SELECT
  h.name AS homestay,
  rt.room_type_id,
  rt.name AS room_type,
  rt.base_price,
  COUNT(r.room_id) FILTER (WHERE r.status = 'Available') AS available_rooms
FROM homestays h
JOIN users u ON u.user_id = h.host_id
JOIN room_types rt ON rt.homestay_id = h.homestay_id
LEFT JOIN rooms r ON r.room_type_id = rt.room_type_id
WHERE u.email = 'host@tripio.demo'
GROUP BY h.name, rt.room_type_id, rt.name, rt.base_price
ORDER BY h.name, rt.base_price;
