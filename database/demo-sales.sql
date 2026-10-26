-- Dữ liệu demo cho popup "Phòng đang giảm giá" trên trang chủ (GET /api/sales).
-- Chạy lại được nhiều lần: không tạo deal trùng khi loại phòng còn deal đang bán; đợt giá cùng tên được thay mới.
-- Deal phút chót chỉ hợp lệ cho đêm trong 3 ngày tới (DealRules), nên chạy lại script gần ngày demo.
-- room_type_id lấy theo dữ liệu Neon hiện tại (bộ Seed20); loại phòng không tồn tại sẽ tự bị bỏ qua.

-- 1) Deal phút chót: 2 đêm bắt đầu từ ngày mai (giờ Việt Nam), ngừng bán 22:00 tối mai, không hoàn tiền.
WITH vn AS (SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1 AS start_date),
deal_plan(room_type_id, discount_percent) AS (VALUES
  (96, 35),   -- Mây Thông House · Phòng gia đình (Đà Lạt)
  (140, 30),  -- Biển Lam House Sơn Trà · Phòng gia đình (Đà Nẵng)
  (104, 25)   -- Sông Ngọc Stay Phú Quốc · Phòng gia đình
)
INSERT INTO room_deals (homestay_id, room_type_id, start_date, end_date, discount_percent, rooms_limit, sale_ends_at,
                        allow_voucher, status, source, created_by, created_at, updated_at)
SELECT r.homestay_id, r.room_type_id, vn.start_date, vn.start_date + 2, p.discount_percent, 1,
       (vn.start_date + TIME '22:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       FALSE, 'Active', 'Manual', h.host_id, now(), now()
FROM deal_plan p
JOIN room_types r ON r.room_type_id = p.room_type_id AND r.status = 'Active'
JOIN homestays h ON h.homestay_id = r.homestay_id AND h.status = 'Approved'
CROSS JOIN vn
WHERE NOT EXISTS (SELECT 1 FROM room_deals d WHERE d.room_type_id = r.room_type_id AND d.status = 'Active' AND d.sale_ends_at > now());

-- 2) Đợt giá thấp hơn giá niêm yết trong 30 ngày tới (áp dụng cho cả đặt phòng thật, như bảng giá của host).
CREATE TEMP TABLE demo_price_plan(room_type_id BIGINT, name VARCHAR(100), price_per_night NUMERIC(18,2)) ON COMMIT DROP;
INSERT INTO demo_price_plan VALUES
  (127, 'Ưu đãi mùa thấp điểm Đà Lạt', 820000),   -- Thông Xanh Villa · Phòng có ban công (giá gốc 1.060.000đ)
  (107, 'Giá tốt cuối thu Đà Nẵng', 790000),      -- Nắng Biển House Đà Nẵng · Phòng có ban công (1.010.000đ)
  (131, 'Ưu đãi chào đông Phú Yên', 850000),      -- Sala Grand HomeStay · Phòng có ban công (1.070.000đ)
  (151, 'Ưu đãi biển xanh tháng 11', 880000);     -- Vườn Dừa Stay Phú Quốc · Phòng có ban công (1.120.000đ)

DELETE FROM room_price_periods pp USING demo_price_plan p
WHERE pp.room_type_id = p.room_type_id AND pp.name = p.name;

INSERT INTO room_price_periods (room_type_id, name, start_date, end_date, price_per_night, created_at)
SELECT r.room_type_id, p.name, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 30,
       p.price_per_night, now()
FROM demo_price_plan p
JOIN room_types r ON r.room_type_id = p.room_type_id AND r.status = 'Active' AND p.price_per_night < r.base_price;

SELECT 'deal' AS kind, h.name AS homestay, r.name AS room_type, d.discount_percent::text AS sale, d.start_date, d.end_date
FROM room_deals d JOIN room_types r ON r.room_type_id = d.room_type_id JOIN homestays h ON h.homestay_id = d.homestay_id
WHERE d.status = 'Active' AND d.sale_ends_at > now()
UNION ALL
SELECT 'price', h.name, r.name || ' · ' || pp.name, pp.price_per_night::text || ' / ' || r.base_price::text, pp.start_date, pp.end_date
FROM room_price_periods pp JOIN room_types r ON r.room_type_id = pp.room_type_id JOIN homestays h ON h.homestay_id = r.homestay_id
WHERE pp.room_type_id IN (127, 107, 131, 151) AND pp.end_date >= CURRENT_DATE;
