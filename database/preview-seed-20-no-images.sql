-- BAN XEM TRUOC - CHUA DUOC THUC THI TREN NEONDB.
-- Du lieu gia phuc vu demo, nhan dien boi tien to seed20 / S20.
-- Khong them homestay_images, room_type_images; icon_url va invoice_file_url de NULL.
-- Script co the chay lai: cac dong da ton tai se duoc bo qua bang ON CONFLICT/NOT EXISTS.

BEGIN;

-- 4 chu nha + 20 khach hang (mat khau demo chung: Demo@123).
INSERT INTO users (full_name, email, phone_number, password_hash, role, status, email_verified_at, created_at, updated_at)
SELECT 'Chủ nhà mẫu ' || i, 'seed20.host' || i || '@tripio.demo', '091100' || lpad(i::text, 4, '0'),
       'VpCx1bLpNi4lpeWoC6HhOA==.cQaJxLl1O1J9UNqM+JVeJCmwhpL0/dqZ51iQONmavsQ=',
       'Host', 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 4) i
ON CONFLICT DO NOTHING;

INSERT INTO users (full_name, email, phone_number, password_hash, role, status, email_verified_at, created_at, updated_at)
SELECT 'Khách hàng mẫu ' || lpad(i::text, 2, '0'), 'seed20.customer' || i || '@tripio.demo',
       '092200' || lpad(i::text, 4, '0'),
       '6C8rmCqTYrIt6QvTr4vvhg==.PRhPb8zalnNVFXTHxBTjdee7CUaf5eEMzeexwAZ6wcs=',
       'Customer', 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 20) i
ON CONFLICT DO NOTHING;

-- 20 lien ket dang nhap ngoai gia lap.
INSERT INTO user_external_logins (user_id, provider, provider_subject, provider_email, email_verified, created_at, last_login_at)
SELECT u.user_id, CASE WHEN i % 2 = 0 THEN 'Google' ELSE 'Facebook' END,
       'seed20-provider-' || i, u.email, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 20) i
JOIN users u ON u.email = 'seed20.customer' || i || '@tripio.demo'
ON CONFLICT DO NOTHING;

-- 20 tien nghi, trong do 8 tien nghi dau tien lay theo anh tham khao.
INSERT INTO amenities (name, icon_url, category, description)
VALUES
  ('Nhà bếp', NULL, 'Tiện ích', 'Có khu vực bếp và dụng cụ nấu ăn'),
  ('Nhìn ra thành phố', NULL, 'Phòng', 'Phòng có tầm nhìn hướng thành phố'),
  ('Sân vườn', NULL, 'Tiện ích', 'Có khuôn viên sân vườn'),
  ('Cho phép mang theo vật nuôi', NULL, 'Dịch vụ', 'Khách được mang theo vật nuôi theo quy định'),
  ('WiFi miễn phí', NULL, 'Internet', 'WiFi miễn phí trong phòng và khu vực chung'),
  ('Ban công', NULL, 'Phòng', 'Phòng có ban công riêng'),
  ('Chỗ đỗ xe miễn phí', NULL, 'Dịch vụ', 'Chỗ đỗ xe miễn phí dành cho khách'),
  ('Máy điều hòa', NULL, 'Phòng', 'Điều hòa không khí riêng trong phòng'),
  ('TV màn hình phẳng', NULL, 'Phòng', 'TV màn hình phẳng có truyền hình cáp'),
  ('Phòng tắm riêng', NULL, 'Phòng', 'Phòng tắm và nước nóng riêng'),
  ('Máy sấy tóc', NULL, 'Phòng', 'Máy sấy tóc trong phòng'),
  ('Ấm đun nước', NULL, 'Phòng', 'Ấm đun nước điện'),
  ('Tủ lạnh mini', NULL, 'Phòng', 'Tủ lạnh mini trong phòng'),
  ('Dọn phòng hằng ngày', NULL, 'Dịch vụ', 'Dịch vụ vệ sinh phòng mỗi ngày'),
  ('Lễ tân 24 giờ', NULL, 'Dịch vụ', 'Hỗ trợ khách hàng cả ngày'),
  ('Hồ bơi', NULL, 'Giải trí', 'Hồ bơi dùng chung'),
  ('Khu vui chơi trẻ em', NULL, 'Giải trí', 'Khu vực vui chơi an toàn cho trẻ'),
  ('Máy giặt', NULL, 'Tiện ích', 'Có máy giặt dùng chung'),
  ('Bàn làm việc', NULL, 'Phòng', 'Bàn làm việc trong phòng'),
  ('Dịch vụ đưa đón', NULL, 'Dịch vụ', 'Đưa đón sân bay theo yêu cầu')
ON CONFLICT DO NOTHING;

-- 20 homestay o nhieu dia phuong.
INSERT INTO homestays (host_id, name, description, address_line, ward, district, province,
                       latitude, longitude, check_in_time, check_out_time, status, created_at, updated_at)
SELECT h.user_id, 'Seed20 Homestay ' || lpad(i::text, 2, '0'),
       'Homestay dữ liệu mẫu số ' || i || ', dùng để kiểm thử giao diện và nghiệp vụ.',
       (10 + i) || ' Đường Biển', 'Phường ' || (1 + i % 8),
       (ARRAY['Phú Quốc','Sơn Trà','Đà Lạt','Nha Trang'])[1 + ((i - 1) % 4)],
       (ARRAY['Kiên Giang','Đà Nẵng','Lâm Đồng','Khánh Hòa'])[1 + ((i - 1) % 4)],
       10.0000000 + i / 100.0, 106.0000000 + i / 100.0,
       TIME '14:00', TIME '12:00', 'Approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 20) i
JOIN users h ON h.email = 'seed20.host' || (1 + ((i - 1) % 4)) || '@tripio.demo'
WHERE NOT EXISTS (SELECT 1 FROM homestays x WHERE x.name = 'Seed20 Homestay ' || lpad(i::text, 2, '0'));

-- Moi homestay co 4 loai: phong don, phong doi, phong ban cong, phong gia dinh.
INSERT INTO room_types (homestay_id, name, description, base_price, max_adults, max_children, bed_type, room_size, status, created_at, updated_at)
SELECT h.homestay_id, rt.name, rt.description, rt.base_price + i * 10000,
       rt.max_adults, rt.max_children, rt.bed_type, rt.room_size,
       'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 20) i
JOIN homestays h ON h.name = 'Seed20 Homestay ' || lpad(i::text, 2, '0')
CROSS JOIN (VALUES
  ('Phòng đơn', 'Phòng riêng gọn gàng dành cho một khách.', 450000::numeric, 1, 0, 'Single', 18::numeric),
  ('Phòng đôi', 'Phòng đôi tiện nghi dành cho hai khách.', 700000::numeric, 2, 1, 'Queen', 26::numeric),
  ('Phòng có ban công', 'Phòng rộng có ban công riêng và tầm nhìn thoáng.', 950000::numeric, 3, 1, 'King + Single', 32::numeric),
  ('Phòng gia đình', 'Phòng rộng dành cho gia đình hoặc nhóm bạn.', 1350000::numeric, 4, 2, '2 Queen', 45::numeric)
) AS rt(name, description, base_price, max_adults, max_children, bed_type, room_size)
ON CONFLICT DO NOTHING;

INSERT INTO rooms (room_type_id, room_number, floor_number, status, note, created_at, updated_at)
SELECT rt.room_type_id,
       'S20-' || lpad(i::text, 2, '0') || '-' || CASE rt.name WHEN 'Phòng đơn' THEN 'S' WHEN 'Phòng đôi' THEN 'D' WHEN 'Phòng có ban công' THEN 'B' ELSE 'F' END,
       CASE rt.name WHEN 'Phòng đơn' THEN 1 WHEN 'Phòng đôi' THEN 2 WHEN 'Phòng có ban công' THEN 3 ELSE 4 END,
       'Available', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 20) i
JOIN homestays h ON h.name = 'Seed20 Homestay ' || lpad(i::text, 2, '0')
JOIN room_types rt ON rt.homestay_id = h.homestay_id AND rt.name IN ('Phòng đơn','Phòng đôi','Phòng có ban công','Phòng gia đình')
ON CONFLICT DO NOTHING;

-- Gan 8 tien nghi trong anh cho moi homestay.
INSERT INTO homestay_amenities (homestay_id, amenity_id)
SELECT h.homestay_id, a.amenity_id
FROM generate_series(1, 20) i
JOIN homestays h ON h.name = 'Seed20 Homestay ' || lpad(i::text, 2, '0')
JOIN amenities a ON a.name IN ('Nhà bếp','Nhìn ra thành phố','Sân vườn','Cho phép mang theo vật nuôi','WiFi miễn phí','Ban công','Chỗ đỗ xe miễn phí','Máy điều hòa')
ON CONFLICT DO NOTHING;

-- Tien nghi phong co ban; ban cong chi gan cho dung loai phong co ban cong.
INSERT INTO room_type_amenities (room_type_id, amenity_id)
SELECT rt.room_type_id, a.amenity_id
FROM generate_series(1, 20) i
JOIN homestays h ON h.name = 'Seed20 Homestay ' || lpad(i::text, 2, '0')
JOIN room_types rt ON rt.homestay_id = h.homestay_id
JOIN amenities a ON a.name IN ('WiFi miễn phí','Máy điều hòa','TV màn hình phẳng','Phòng tắm riêng')
ON CONFLICT DO NOTHING;

INSERT INTO room_type_amenities (room_type_id, amenity_id)
SELECT rt.room_type_id, a.amenity_id
FROM homestays h
JOIN room_types rt ON rt.homestay_id = h.homestay_id AND rt.name = 'Phòng có ban công'
JOIN amenities a ON a.name IN ('Ban công','Nhìn ra thành phố')
WHERE h.name LIKE 'Seed20 Homestay %'
ON CONFLICT DO NOTHING;

INSERT INTO room_type_amenities (room_type_id, amenity_id)
SELECT rt.room_type_id, a.amenity_id
FROM homestays h
JOIN room_types rt ON rt.homestay_id = h.homestay_id AND rt.name = 'Phòng gia đình'
JOIN amenities a ON a.name IN ('Nhà bếp','Ấm đun nước','Tủ lạnh mini')
WHERE h.name LIKE 'Seed20 Homestay %'
ON CONFLICT DO NOTHING;

-- 30 don: 15 Completed de danh gia, 15 Cancelled de thu nghiem huy phong.
INSERT INTO bookings (booking_code, customer_id, homestay_id, check_in_date, check_out_date,
                      adult_count, child_count, subtotal, discount_amount, service_fee, tax_amount,
                      total_amount, status, customer_note, created_at, updated_at)
SELECT 'S20-' || lpad(i::text, 4, '0'), u.user_id, h.homestay_id,
       CURRENT_DATE - (50 - i), CURRENT_DATE - (48 - i), 2, i % 2,
       rt.base_price * 2, CASE WHEN i <= 15 THEN 10000 ELSE 0 END, 0, 0,
       rt.base_price * 2 - CASE WHEN i <= 15 THEN 10000 ELSE 0 END,
       CASE WHEN i <= 15 THEN 'Completed' ELSE 'Cancelled' END,
       'Đơn đặt phòng dữ liệu mẫu ' || i, CURRENT_TIMESTAMP - (50 - i) * INTERVAL '1 day', CURRENT_TIMESTAMP
FROM generate_series(1, 30) i
JOIN users u ON u.email = 'seed20.customer' || (1 + ((i - 1) % 20)) || '@tripio.demo'
JOIN homestays h ON h.name = 'Seed20 Homestay ' || lpad((1 + ((i - 1) % 20))::text, 2, '0')
JOIN room_types rt ON rt.homestay_id = h.homestay_id
  AND rt.name = (ARRAY['Phòng đơn','Phòng đôi','Phòng có ban công','Phòng gia đình'])[1 + ((i - 1) % 4)]
ON CONFLICT DO NOTHING;

INSERT INTO booking_details (booking_id, room_type_id, room_id, quantity, price_per_night,
                             number_of_nights, extra_fee, line_total, guest_name, note)
SELECT b.booking_id, rt.room_type_id, r.room_id, 1, rt.base_price, 2, 0, rt.base_price * 2,
       u.full_name, 'Chi tiết mẫu cho ' || b.booking_code
FROM generate_series(1, 30) i
JOIN bookings b ON b.booking_code = 'S20-' || lpad(i::text, 4, '0')
JOIN users u ON u.user_id = b.customer_id
JOIN room_types rt ON rt.homestay_id = b.homestay_id
  AND rt.name = (ARRAY['Phòng đơn','Phòng đôi','Phòng có ban công','Phòng gia đình'])[1 + ((i - 1) % 4)]
JOIN rooms r ON r.room_type_id = rt.room_type_id
WHERE NOT EXISTS (SELECT 1 FROM booking_details d WHERE d.booking_id = b.booking_id);

-- 30 thanh toan va 30 hoa don de moi don deu co du lieu lien quan.
INSERT INTO payments (booking_id, transaction_code, payment_method, transaction_type, amount,
                      status, paid_at, gateway_response, created_at, updated_at)
SELECT b.booking_id, 'S20-TXN-' || lpad(i::text, 4, '0'),
       (ARRAY['VNPay','MoMo','BankTransfer','Cash'])[1 + ((i - 1) % 4)], 'Payment', b.total_amount,
       'Success', CURRENT_TIMESTAMP - INTERVAL '30 days', '{"source":"seed20"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 30) i JOIN bookings b ON b.booking_code = 'S20-' || lpad(i::text, 4, '0')
ON CONFLICT DO NOTHING;

INSERT INTO invoices (invoice_number, booking_id, customer_name, customer_email, customer_address,
                      tax_code, subtotal, tax_amount, total_amount, issued_at, status, invoice_file_url)
SELECT 'S20-INV-' || lpad(i::text, 4, '0'), b.booking_id, u.full_name, u.email, NULL, NULL,
       b.subtotal, b.tax_amount, b.subtotal + b.tax_amount, CURRENT_TIMESTAMP - INTERVAL '29 days', 'Issued', NULL
FROM generate_series(1, 30) i
JOIN bookings b ON b.booking_code = 'S20-' || lpad(i::text, 4, '0')
JOIN users u ON u.user_id = b.customer_id
ON CONFLICT DO NOTHING;

-- 15 check-out hoan tat va 15 yeu cau huy: phu hop trang thai tung don.
INSERT INTO check_in_outs (booking_id, checked_in_by, actual_check_in_at, checked_out_by,
                           actual_check_out_at, guest_identity_number, deposit_amount,
                           additional_charge, note, status)
SELECT b.booking_id, host.user_id, CURRENT_TIMESTAMP - (35 - i) * INTERVAL '1 day', host.user_id,
       CURRENT_TIMESTAMP - (34 - i) * INTERVAL '1 day', 'CCCD-S20-' || lpad(i::text, 4, '0'),
       500000, 0, 'Đã hoàn tất lưu trú mẫu', 'CheckedOut'
FROM generate_series(1, 15) i
JOIN bookings b ON b.booking_code = 'S20-' || lpad(i::text, 4, '0')
JOIN homestays h ON h.homestay_id = b.homestay_id
JOIN users host ON host.user_id = h.host_id
ON CONFLICT DO NOTHING;

INSERT INTO cancellations (booking_id, cancelled_by, reason, cancelled_at, cancellation_fee,
                           refund_amount, status, processed_by, processed_at)
SELECT b.booking_id, b.customer_id, 'Khách thay đổi kế hoạch chuyến đi', CURRENT_TIMESTAMP - INTERVAL '20 days',
       0, b.total_amount, 'Refunded', host.user_id, CURRENT_TIMESTAMP - INTERVAL '19 days'
FROM generate_series(16, 30) i
JOIN bookings b ON b.booking_code = 'S20-' || lpad(i::text, 4, '0')
JOIN homestays h ON h.homestay_id = b.homestay_id
JOIN users host ON host.user_id = h.host_id
ON CONFLICT DO NOTHING;

-- 15 danh gia, trong do mot nua co phan hoi cua chu nha.
INSERT INTO reviews (booking_id, customer_id, homestay_id, rating, comment, host_reply,
                     host_replied_at, status, created_at, updated_at)
SELECT b.booking_id, b.customer_id, b.homestay_id, 3 + (i % 3),
       'Trải nghiệm mẫu số ' || i || ': phòng sạch, chủ nhà thân thiện và vị trí thuận tiện.',
       CASE WHEN i % 2 = 0 THEN 'Cảm ơn bạn đã lựa chọn homestay. Hẹn gặp lại!' END,
       CASE WHEN i % 2 = 0 THEN CURRENT_TIMESTAMP - INTERVAL '10 days' END,
       'Visible', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
FROM generate_series(1, 15) i
JOIN bookings b ON b.booking_code = 'S20-' || lpad(i::text, 4, '0')
ON CONFLICT DO NOTHING;

-- 20 voucher; 15 luot su dung tren cac don Completed.
INSERT INTO vouchers (code, name, description, discount_type, discount_value, maximum_discount,
                      minimum_booking_amount, valid_from, valid_until, usage_limit,
                      usage_limit_per_customer, homestay_id, status, created_by, created_at, updated_at)
SELECT 'S20VC' || lpad(i::text, 3, '0'), 'Voucher mẫu ' || i, 'Ưu đãi dùng để kiểm thử',
       CASE WHEN i % 2 = 0 THEN 'Percentage' ELSE 'FixedAmount' END,
       CASE WHEN i % 2 = 0 THEN 10 ELSE 50000 END,
       CASE WHEN i % 2 = 0 THEN 200000 ELSE NULL END,
       500000, CURRENT_TIMESTAMP - INTERVAL '60 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
       100, 2, CASE WHEN i % 3 = 0 THEN h.homestay_id END, 'Active', host.user_id,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 20) i
JOIN homestays h ON h.name = 'Seed20 Homestay ' || lpad(i::text, 2, '0')
JOIN users host ON host.user_id = h.host_id
ON CONFLICT DO NOTHING;

INSERT INTO voucher_usages (voucher_id, booking_id, customer_id, code_used, discount_amount, used_at)
SELECT v.voucher_id, b.booking_id, b.customer_id, v.code, 10000, CURRENT_TIMESTAMP - INTERVAL '30 days'
FROM generate_series(1, 15) i
JOIN vouchers v ON v.code = 'S20VC' || lpad(i::text, 3, '0')
JOIN bookings b ON b.booking_code = 'S20-' || lpad(i::text, 4, '0')
ON CONFLICT DO NOTHING;

-- Bang anh duoc co y bo qua theo yeu cau.
COMMIT;

-- Bao cao xem lai so dong seed sau khi chay (chi SELECT).
SELECT 'users' AS table_name, count(*) AS seed_rows FROM users WHERE email LIKE 'seed20.%@tripio.demo'
UNION ALL SELECT 'homestays', count(*) FROM homestays WHERE name LIKE 'Seed20 Homestay %'
UNION ALL SELECT 'room_types', count(*) FROM room_types rt JOIN homestays h USING (homestay_id) WHERE h.name LIKE 'Seed20 Homestay %' AND rt.name IN ('Phòng đơn','Phòng đôi','Phòng có ban công','Phòng gia đình')
UNION ALL SELECT 'rooms', count(*) FROM rooms WHERE room_number LIKE 'S20-%'
UNION ALL SELECT 'bookings', count(*) FROM bookings WHERE booking_code LIKE 'S20-%'
UNION ALL SELECT 'reviews', count(*) FROM reviews r JOIN bookings b USING (booking_id) WHERE b.booking_code LIKE 'S20-%'
UNION ALL SELECT 'vouchers', count(*) FROM vouchers WHERE code LIKE 'S20VC%'
ORDER BY table_name;
