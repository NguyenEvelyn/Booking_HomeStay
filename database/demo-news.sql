-- Bài viết mẫu cho mục Tin tức & cẩm nang (news_posts). Chạy lại được: bài cùng slug được cập nhật nội dung.
-- Ảnh bìa lấy ảnh đại diện của homestay thật (URL https trên Supabase); không tìm thấy thì để trống (giao diện có ảnh dự phòng).
-- Tác giả: tài khoản Admin đầu tiên.

WITH author AS (SELECT user_id FROM users WHERE role = 'Admin' ORDER BY user_id LIMIT 1),
cover(slug, homestay_pattern) AS (VALUES
  ('san-deal-phut-chot-tren-tripio', 'Mây Thông%'),
  ('da-lat-mua-thap-diem-di-khi-nao', 'Thông Xanh%'),
  ('5-diem-den-bien-cho-chuyen-di-cuoi-tuan', '%Phú Quốc%'),
  ('chon-homestay-cho-ca-gia-dinh', 'Sala Grand%'),
  ('huy-phong-va-hoan-tien-tren-tripio', 'Nắng Biển%')
),
post(slug, title, summary, category, featured, days_ago, content) AS (VALUES
('san-deal-phut-chot-tren-tripio',
 'Săn deal phút chót trên Tripio: giảm đến 70% cho chuyến đi gần',
 'Deal phút chót là phòng còn trống trong 0–3 ngày tới được chủ nhà giảm giá mạnh. Đây là cách tìm, đặt và những điều cần biết trước khi chốt.',
 'UuDai', TRUE, 1,
'Bạn quyết định đi chơi vào phút chót? Đó lại là lúc dễ gặp giá tốt nhất. Trên Tripio, chủ nhà có thể mở bán deal cho những phòng còn trống trong 3 ngày tới với mức giảm từ 5% đến 70%.

## Tìm deal ở đâu?
Ngay khi mở trang chủ, banner "Phòng đang giảm giá" hiện các deal và đợt giá ưu đãi đang chạy. Mục Săn phòng giá rẻ cũng liệt kê deal kèm đồng hồ đếm ngược đến giờ ngừng bán.

## Đặt deal thế nào?
Bấm Đặt ngay, Tripio mở đúng homestay với ngày và loại phòng đã chọn sẵn. Giá deal hiện trong bảng giá trước khi bạn thanh toán, bạn chỉ cần kiểm tra lại số khách rồi tiếp tục.

## Điều cần biết
Đơn đặt bằng giá deal không được hoàn tiền khi hủy, vì vậy hãy chắc chắn lịch trình trước khi thanh toán. Deal chỉ áp dụng khi mọi đêm của kỳ nghỉ nằm trong khoảng ngày của deal và không cộng dồn với khuyến mãi tự động. Một số deal cho phép dùng thêm voucher, điều này được ghi rõ khi thanh toán.

Mẹo nhỏ: số phòng bán deal có hạn và deal ngừng bán vào buổi tối của đêm đầu tiên, nên quyết định sớm sẽ có nhiều lựa chọn hơn.'),
('da-lat-mua-thap-diem-di-khi-nao',
 'Đà Lạt mùa thấp điểm: đi khi nào để vừa đẹp vừa rẻ?',
 'Tháng 10–11 và các ngày giữa tuần là thời điểm Đà Lạt vắng khách, giá phòng mềm hơn mà thời tiết vẫn dễ chịu. Gợi ý lịch trình và cách đặt phòng tiết kiệm.',
 'DiemDen', FALSE, 2,
'Đà Lạt đẹp quanh năm, nhưng giá phòng thay đổi rất nhiều theo mùa. Nếu linh hoạt về thời gian, bạn có thể tiết kiệm đáng kể mà vẫn tận hưởng trọn vẹn thành phố sương mù.

## Khi nào là mùa thấp điểm?
Ngoài các dịp lễ, Tết và mùa hoa dã quỳ cuối năm, những tuần giữa tháng 10 và tháng 11 thường vắng khách hơn. Các ngày từ thứ Hai đến thứ Năm cũng rẻ hơn cuối tuần, vì nhiều homestay áp dụng phụ thu cuối tuần.

## Đặt phòng sao cho rẻ?
Trên trang chi tiết homestay, lịch đặt phòng hiển thị giá từng đêm ngay dưới mỗi ngày: màu cam là giá cao hơn bình thường, màu xanh là giá đang ưu đãi. Chọn những đêm màu xanh và tránh tối thứ Sáu, thứ Bảy là cách đơn giản nhất. Đặt trước từ 30 ngày có thể được ưu đãi đặt sớm, còn ở từ 5 đêm có ưu đãi ở dài ngày.

## Gợi ý 3 ngày 2 đêm
Ngày đầu dạo hồ Xuân Hương và chợ đêm. Ngày thứ hai săn mây buổi sớm, chiều ghé các đồi chè. Ngày cuối thong thả cà phê trước khi trả phòng. Nhớ kiểm tra giờ nhận và trả phòng trong mục Chính sách homestay để sắp xếp lịch trình.'),
('5-diem-den-bien-cho-chuyen-di-cuoi-tuan',
 '5 điểm đến biển lý tưởng cho chuyến đi cuối tuần',
 'Phú Quốc, Đà Nẵng, Phú Yên, Vũng Tàu hay Quy Nhơn: mỗi nơi một vẻ, đều đi được trong 2–3 ngày. Gợi ý thời điểm đẹp và kiểu homestay phù hợp.',
 'DiemDen', FALSE, 4,
'Chỉ cần một kỳ nghỉ cuối tuần là đủ để nạp lại năng lượng bên biển. Dưới đây là 5 điểm đến dễ đi, nhiều lựa chọn lưu trú trên Tripio.

## Phú Quốc
Biển trong, hoàng hôn đẹp ở bờ Tây. Các homestay gần bãi biển rất hợp cho cặp đôi muốn nghỉ ngơi thật sự.

## Đà Nẵng
Thuận tiện đi lại, vừa có biển Mỹ Khê, vừa gần bán đảo Sơn Trà. Phù hợp cho nhóm bạn thích kết hợp tắm biển và khám phá ẩm thực.

## Phú Yên
Hoang sơ và yên bình, giá phòng dễ chịu. Rất hợp với gia đình có trẻ nhỏ.

## Vũng Tàu
Gần TP. Hồ Chí Minh, đi về trong hai ngày. Nên đặt sớm vì cuối tuần thường kín phòng.

## Quy Nhơn
Nhiều bãi biển đẹp và còn vắng. Thích hợp cho chuyến đi dài hơn một chút.

Mẹo: dùng bộ lọc số khách khi tìm kiếm. Trẻ em dưới 1m2 không tính vào sức chứa phòng, nên gia đình có bé nhỏ thường chỉ cần một phòng.'),
('chon-homestay-cho-ca-gia-dinh',
 'Bí quyết chọn homestay cho cả gia đình',
 'Đi đông người cần để ý sức chứa, phụ thu trẻ em và chính sách hủy. Checklist ngắn để chọn đúng phòng ngay từ lần đầu.',
 'CamNang', FALSE, 6,
'Một chuyến đi gia đình suôn sẻ bắt đầu từ việc chọn đúng phòng. Đây là những điều nên kiểm tra trước khi đặt.

## Sức chứa và trẻ em
Mỗi loại phòng có số khách tiêu chuẩn đã gồm trong giá. Người lớn và trẻ cao từ 1m2 tính vào sức chứa này. Trẻ dưới 1m2 được miễn phí và không tính vào sức chứa. Nếu đoàn đông hơn, Tripio sẽ gợi ý phòng lớn hơn, đặt thêm phòng hoặc homestay khác phù hợp.

## Phụ thu
Một số phòng cho ở thêm trẻ em hoặc người lớn với phụ thu theo đêm. Mọi khoản phụ thu đều hiện trong bảng giá trước khi thanh toán, không phát sinh bất ngờ.

## Tiện nghi nên có
Phòng gia đình rộng, có bếp hoặc khu sinh hoạt chung, chỗ đỗ xe và khu vui chơi gần nhà sẽ giúp cả nhà thoải mái hơn.

## Đừng quên chính sách
Xem mục Chính sách homestay để biết giờ nhận và trả phòng, quy định thú cưng, giờ yên tĩnh và đặc biệt là các mốc hoàn tiền khi hủy.'),
('huy-phong-va-hoan-tien-tren-tripio',
 'Hủy phòng và hoàn tiền trên Tripio hoạt động thế nào?',
 'Số tiền được hoàn phụ thuộc vào thời điểm bạn hủy so với ngày nhận phòng. Cách đọc bảng hoàn tiền và mục Tính thử theo ngày bạn chọn.',
 'CamNang', FALSE, 7,
'Kế hoạch có thể thay đổi. Hiểu rõ chính sách hủy giúp bạn yên tâm khi đặt phòng.

## Mốc hoàn tiền
Mỗi homestay có bảng hoàn tiền theo số ngày trước ngày nhận phòng. Ví dụ chính sách phổ biến: hủy trước từ 14 ngày được hoàn 100%, từ 7 đến 13 ngày hoàn 70%, từ 3 đến 6 ngày hoàn 50%, còn 2 ngày trở xuống không hoàn tiền. Phần trăm hoàn được tính trên số tiền bạn đã thanh toán, gồm tiền cọc hoặc toàn bộ.

## Tính thử theo ngày bạn chọn
Trên trang homestay, mở mục Chính sách homestay rồi chọn ô Hủy phòng. Khi bạn đã chọn ngày nhận phòng, Tripio đổi các mốc trên thành ngày cụ thể và ước tính số tiền được hoàn.

## Những lưu ý
Bạn có thể tự hủy đơn đến hết ngày trước ngày nhận phòng. Trong ngày nhận phòng, vui lòng liên hệ chủ nhà. Đơn đặt bằng deal phút chót không được hoàn tiền. Chính sách được lưu cùng đơn tại thời điểm đặt, nên thay đổi sau đó của homestay không ảnh hưởng đến đơn của bạn.')
)
INSERT INTO news_posts (slug, title, summary, content, cover_image_url, category, status, is_featured, published_at, author_id, created_at, updated_at)
SELECT p.slug, p.title, p.summary, p.content,
       (SELECT i.image_url FROM homestay_images i JOIN homestays h ON h.homestay_id = i.homestay_id
        WHERE h.name ILIKE c.homestay_pattern AND h.status = 'Approved' AND i.image_url LIKE 'https://%'
        ORDER BY i.is_thumbnail DESC, i.sort_order LIMIT 1),
       p.category, 'Published', p.featured, now() - make_interval(days => p.days_ago), (SELECT user_id FROM author), now(), now()
FROM post p JOIN cover c ON c.slug = p.slug
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, content = EXCLUDED.content,
  cover_image_url = COALESCE(EXCLUDED.cover_image_url, news_posts.cover_image_url), category = EXCLUDED.category,
  is_featured = EXCLUDED.is_featured, updated_at = now();

SELECT slug, category, status, published_at, cover_image_url IS NOT NULL AS has_cover FROM news_posts ORDER BY published_at DESC;
