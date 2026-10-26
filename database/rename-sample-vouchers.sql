-- Đặt tên và mô tả dễ hiểu cho 20 voucher mẫu S20VC001–S20VC020 (tạo bởi preview-seed-20-no-images.sql).
-- Chỉ đổi name/description: mã, mức giảm và điều kiện giữ nguyên (voucher_usages tham chiếu theo mã).
-- Voucher lẻ: giảm 50.000đ; voucher chẵn: giảm 10% tối đa 200.000đ; đơn tối thiểu 500.000đ.
UPDATE vouchers AS v
SET name = x.name, description = x.description, updated_at = CURRENT_TIMESTAMP
FROM (VALUES
  ('S20VC001', 'Chào bạn mới Tripio',        'Giảm ngay 50.000đ cho chuyến đi đầu tiên cùng Tripio.'),
  ('S20VC002', 'Tuần lễ vàng du lịch',       'Giảm 10% (tối đa 200.000đ) khi đặt bất kỳ homestay nào trên Tripio.'),
  ('S20VC003', 'Săn mây tại Mây Thông',      'Giảm 50.000đ khi đặt phòng tại Mây Thông House.'),
  ('S20VC004', 'Hè rực rỡ',                  'Giảm 10% cho kỳ nghỉ hè, tối đa 200.000đ mỗi đơn.'),
  ('S20VC005', 'Cuối tuần thảnh thơi',       'Giảm 50.000đ cho chuyến đi cuối tuần ngắn ngày.'),
  ('S20VC006', 'Đón nắng biển Đà Nẵng',      'Giảm 10% khi đặt phòng tại Nắng Biển House Đà Nẵng.'),
  ('S20VC007', 'Đặt sớm tiết kiệm',          'Lên kế hoạch sớm, giảm ngay 50.000đ cho đơn đặt phòng.'),
  ('S20VC008', 'Kỳ nghỉ gia đình',           'Giảm 10% (tối đa 200.000đ) cho chuyến đi cùng gia đình.'),
  ('S20VC009', 'Biển xanh Phú Quốc',         'Giảm 50.000đ khi đặt phòng tại Cát Trắng Retreat Phú Quốc.'),
  ('S20VC010', 'Đi cùng hội bạn',            'Giảm 10% cho chuyến đi nhóm, tối đa 200.000đ mỗi đơn.'),
  ('S20VC011', 'Ngày thường giá tốt',        'Giảm 50.000đ cho kỳ nghỉ giữa tuần, tránh đông đúc.'),
  ('S20VC012', 'Nghỉ dưỡng Sala Grand',      'Giảm 10% khi đặt phòng tại Sala Grand HomeStay.'),
  ('S20VC013', 'Trốn phố về núi',            'Giảm 50.000đ cho chuyến đi tìm không khí trong lành.'),
  ('S20VC014', 'Mùa lễ hội',                 'Giảm 10% (tối đa 200.000đ) cho kỳ nghỉ dịp lễ.'),
  ('S20VC015', 'Sương sớm Mộc Sương',        'Giảm 50.000đ khi đặt phòng tại Mộc Sương Homestay.'),
  ('S20VC016', 'Kỳ nghỉ cặp đôi',            'Giảm 10% cho chuyến đi lãng mạn dành cho hai người.'),
  ('S20VC017', 'Thành viên thân thiết',      'Cảm ơn bạn đã đồng hành, giảm 50.000đ cho đơn tiếp theo.'),
  ('S20VC018', 'Hoàng hôn ven biển',         'Giảm 10% khi đặt phòng tại Anh Duong Coastal House.'),
  ('S20VC019', 'Flash sale cuối tháng',      'Giảm nhanh 50.000đ cho đơn đặt phòng trong tháng.'),
  ('S20VC020', 'Chào năm mới',               'Giảm 10% (tối đa 200.000đ) cho chuyến đi đón năm mới.')
) AS x(code, name, description)
WHERE v.code = x.code;

SELECT code, name FROM vouchers WHERE code LIKE 'S20VC%' ORDER BY code;
