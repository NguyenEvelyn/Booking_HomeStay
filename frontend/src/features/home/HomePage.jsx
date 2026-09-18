import React, { useEffect, useState } from 'react';
import heroImage from '../../../assets/figma/hero.png';
import aboutImage from '../../../assets/figma/about.jpg';
import sunsetImage from '../../../assets/figma/stay-sunset.jpg';
import azureImage from '../../../assets/figma/stay-azure.jpg';
import oceanImage from '../../../assets/figma/stay-ocean.png';
import coastalImage from '../../../assets/figma/stay-coastal.jpg';
import seasideImage from '../../../assets/figma/stay-seaside.jpg';
import offersImage from '../../../assets/figma/offers-bg.png';
import voucherWeek from '../../../assets/figma/voucher-week.png';
import voucherHotDeal from '../../../assets/figma/voucher-hotdeal.png';
import voucherSummer from '../../../assets/figma/voucher-summer.png';
import blogOne from '../../../assets/figma/blog-1.jpg';
import blogTwo from '../../../assets/figma/blog-2.jpg';
import blogThree from '../../../assets/figma/blog-3.jpg';
import phuQuoc from '../../../assets/figma/destination-phuquoc.png';
import quyNhon from '../../../assets/figma/destination-quynhon.jpg';
import vungTau from '../../../assets/figma/destination-vungtau.jpg';
import daNang from '../../../assets/figma/destination-danang.png';
import haLong from '../../../assets/figma/destination-halong.jpg';
import { homestayApi } from '../homestays/api/homestayApi.js';

const fallbackStays = [
  { name: 'The Sunset Residence', location: 'Phú Quốc, Việt Nam', price: '1,456k VND', rating: '4,8', image: sunsetImage },
  { name: 'Azure Bay Retreat', location: 'Đà Nẵng, Việt Nam', price: '1,156k VND', rating: '4,2', image: azureImage },
  { name: 'Ocean Crest Residence', location: 'Quy Nhơn, Việt Nam', price: '2,559k VND', rating: '4,9', image: oceanImage },
  { name: 'The Coastal Haven', location: 'Phú Quý, Việt Nam', price: '1,009k VND', rating: '4,1', image: coastalImage },
  { name: 'Seaside Pearl Resort', location: 'Vĩnh Hy, Việt Nam', price: '1,999k VND', rating: '4,9', image: seasideImage }
];

const destinations = [
  ['01', 'Phú Quốc', phuQuoc], ['02', 'Quy Nhơn', quyNhon], ['03', 'Vũng Tàu', vungTau],
  ['04', 'Đà Nẵng', daNang], ['05', 'Vịnh Hạ Long', haLong]
];

const posts = [
  ['5 điểm đến biển lý tưởng cho chuyến đi cuối tuần', blogOne],
  ['Bí quyết lựa chọn homestay phù hợp cho mọi chuyến đi', blogTwo],
  ['Những trải nghiệm không thể bỏ lỡ trong hành trình', blogThree]
];

const heroStays = [
  ['The Whispering Pines Retreat', oceanImage],
  ['Ocean Breeze Private Retreat', coastalImage],
  ['Ocean Breeze Private Retreat', seasideImage],
  ['Azure Bay Private Retreat', azureImage]
];

const offers = [voucherWeek, voucherHotDeal, voucherSummer, voucherHotDeal, voucherWeek];

export default function HomePage({ user, onLogout, onChangePassword, onBrowseHomestays, onOpenHomestay, onDeveloping }) {
  const [menuScrolled, setMenuScrolled] = useState(false);
  const [homeStays, setHomeStays] = useState(fallbackStays);
  const [homestayTotal, setHomestayTotal] = useState(0);
  const totalReviews = homeStays.reduce((sum, stay) => sum + (stay.reviewCount || 0), 0);
  const averageRating = totalReviews ? homeStays.reduce((sum, stay) => sum + (stay.ratingValue || 0) * (stay.reviewCount || 0), 0) / totalReviews : 0;

  useEffect(() => {
    const updateMenu = () => setMenuScrolled(window.scrollY > 24);
    updateMenu();
    window.addEventListener('scroll', updateMenu, { passive: true });
    return () => window.removeEventListener('scroll', updateMenu);
  }, []);

  useEffect(() => {
    homestayApi.list({ page: 1 }).then(async (result) => {
      setHomestayTotal(result.total);
      const items = await Promise.all(result.items.slice(0, 5).map(async (item, index) => {
        const review = await homestayApi.reviews(item.id).catch(() => ({ average: 0, total: 0 }));
        return { id: item.id, name: item.name, location: `${item.district}, ${item.province}`, price: item.fromPrice, ratingValue: review.average, reviewCount: review.total, image: item.thumbnailUrl || fallbackStays[index % fallbackStays.length].image };
      }));
      if (items.length) setHomeStays(items);
    }).catch(() => {});
  }, []);

  return <div className="home-page">
    <section className="hero" id="home" style={{ backgroundImage: `url('${heroImage}')` }}>
      <nav className={`home-nav${menuScrolled ? ' is-scrolled' : ''}`}>
        <a className="home-logo" href="#home">tripio</a>
        <div className="nav-links">
          <a className="active" href="#home">Trang chủ</a><a href="#about">Giới thiệu</a><a href="#stays">Địa điểm</a><a href="#stays" onClick={(event) => { event.preventDefault(); onBrowseHomestays(); }}>Homestay</a><a href="#offers">Ưu đãi</a><a href="#footer">Tin tức</a>
        </div>
        <div className="nav-actions"><button type="button" aria-label="Đổi mật khẩu" title={`${user.fullName} · Đổi mật khẩu`} onClick={onChangePassword}>♙</button><button type="button" aria-label="Tìm kiếm" onClick={() => onDeveloping('Tìm kiếm nhanh')}>⌕</button></div>
      </nav>
      <div className="hero-shade" />
      <div className="hero-content">
        <h1><strong>FIND YOUR</strong> PERFECT STAY</h1>
        <p>Khám phá những không gian lưu trú tuyệt vời, từ những căn homestay ấm cúng đến các điểm nghỉ dưỡng sang trọng, và bắt đầu hành trình của riêng bạn với những trải nghiệm đáng nhớ</p>
      </div>
      <div className="hero-picks" aria-label="Gợi ý homestay nổi bật">{homeStays.slice(0, 4).map((stay) => <article key={stay.id || stay.name}><img src={stay.image} alt="" /><span>{stay.name}</span><button type="button" aria-label={`Xem ${stay.name}`} onClick={() => stay.id ? onOpenHomestay(stay.id) : onBrowseHomestays()}>↗</button></article>)}</div>
    </section>

    <form className="search-bar" onSubmit={(event) => { event.preventDefault(); onDeveloping('Tìm phòng'); }}>
      <label>Địa điểm hoặc tên khách sạn<span className="search-control"><input placeholder="Bạn muốn đến đâu?" /><i>⌖</i></span></label>
      <label>Ngày nhận<span className="search-control"><input type="text" placeholder="Chọn ngày nhận" onFocus={(event) => { event.currentTarget.type = 'date'; }} onBlur={(event) => { if (!event.currentTarget.value) event.currentTarget.type = 'text'; }} /><i>▣</i></span></label><label>Ngày trả<span className="search-control"><input type="text" placeholder="Chọn ngày trả" onFocus={(event) => { event.currentTarget.type = 'date'; }} onBlur={(event) => { if (!event.currentTarget.value) event.currentTarget.type = 'text'; }} /><i>▣</i></span></label>
      <label>Khách và phòng<select defaultValue=""><option value="" disabled>Chọn số người</option><option>1 khách · 1 phòng</option><option>2 khách · 1 phòng</option><option>Gia đình · 2 phòng</option></select></label>
      <button>Tìm phòng</button>
    </form>

    <section className="about-section page-section" id="about">
      <div className="about-image"><img src={aboutImage} alt="Biệt thự nghỉ dưỡng Tripio" /><span>Tripio</span><small>Nơi những chuyến đi bắt đầu</small></div>
      <div className="about-copy"><p className="kicker">VỀ CHÚNG TÔI</p><h2>CÙNG TRIPIO KẾT NỐI NHỮNG<br />HÀNH TRÌNH <em>ĐÁNG NHỚ</em></h2>
        <p>Tripio là nền tảng đặt phòng homestay trực tuyến, giúp bạn dễ dàng tìm kiếm, khám phá và lựa chọn không gian lưu trú phù hợp cho mỗi chuyến đi. Chúng tôi mang đến đa dạng lựa chọn lưu trú cùng trải nghiệm đặt phòng nhanh chóng, tiện lợi và đáng tin cậy.</p>
        <div className="trust-row"><div className="avatars"><i /><i /><i /></div><span><b>Dữ liệu thực tế</b><br />Từ hệ thống Tripio</span><span><b>{averageRating ? averageRating.toFixed(1) : 'Mới'} ⭐</b><br />{totalReviews} lượt đánh giá</span></div>
        <div className="stats"><div><b>{homestayTotal || homeStays.length}</b><span>Homestay đang hoạt động</span></div><div><b>{new Set(homeStays.map((stay) => stay.location)).size}</b><span>Khu vực nổi bật</span></div><div><b>{totalReviews}</b><span>Đánh giá xác thực</span></div><div><b>{homeStays.reduce((sum, stay) => sum + (stay.reviewCount || 0), 0)}</b><span>Trải nghiệm được chia sẻ</span></div></div>
      </div>
    </section>

    <section className="stays-section page-section" id="stays">
      <div className="stays-intro"><p className="kicker dark">DÀNH CHO BẠN</p><h2>HOMESTAY ĐƯỢC<br /><em>YÊU THÍCH</em></h2><p>Khám phá các homestay được nhiều du khách yêu thích và lựa chọn cho hành trình đáng nhớ.</p><button type="button" onClick={onBrowseHomestays}>Xem tất cả <span>↗</span></button></div>
      <div className="stay-grid">{homeStays.map((stay) => <article className="stay-card" key={stay.id || stay.name} style={{ backgroundImage: `linear-gradient(180deg,transparent 35%,rgba(3,31,45,.86)),url('${stay.image}')` }}>
        <div className="stay-top"><span>⌖ {stay.location}</span><span>{stay.reviewCount ? `★ ${Number(stay.ratingValue).toFixed(1)} · ${stay.reviewCount} đánh giá` : 'Homestay mới'}</span></div>
        <div><h3>{stay.name}</h3><p>Khám phá các hạng phòng và tiện ích đang có tại homestay.</p><footer><b>{typeof stay.price === 'number' ? `Từ ${new Intl.NumberFormat('vi-VN').format(stay.price)}đ` : stay.price}</b><button type="button" onClick={() => stay.id ? onOpenHomestay(stay.id) : onBrowseHomestays()}>Xem phòng</button></footer></div>
      </article>)}</div>
    </section>

    <section className="cta-section" id="offers"><p className="kicker">BẮT ĐẦU HÀNH TRÌNH</p><h2>ĐẶT <em>HOMESTAY</em> DỄ DÀNG VÀ KHÁM PHÁ<br />NHIỀU HƠN CÙNG <em>TRIPIO</em></h2><button type="button" onClick={() => onDeveloping('Đặt phòng')}>Đặt phòng ngay <span>↗</span></button></section>

    <section className="destinations-section page-section"><header><div><p className="kicker dark">XU HƯỚNG DU LỊCH</p><h2>CÁC ĐIỂM ĐẾN ĐANG THỊNH HÀNH</h2></div><div className="carousel-arrows"><button>←</button><button>→</button></div></header><div className="destination-track">{destinations.map(([number, name, image], index) => <article className={index === 0 ? 'featured' : ''} key={name} style={{ backgroundImage: `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.52)),url('${image}')` }}><b>{number}</b><span>{name}</span></article>)}</div></section>

    <section className="offers-section page-section" style={{ backgroundImage: `linear-gradient(90deg,rgba(7,28,75,.72),rgba(7,28,75,.04)),url('${offersImage}')` }}>
      <div className="offers-copy"><a className="offers-logo" href="#home">tripio</a><div><p className="kicker">ƯU ĐÃI CÙNG TRIPIO</p><h2>SĂN NGAY NHỮNG <em>KHUYẾN MÃI</em> HẤP DẪN NHẤT</h2></div></div>
      <div className="voucher-list" aria-label="Danh sách ưu đãi">{offers.map((image, index) => <article className="voucher-card" key={`${image}-${index}`}><img src={image} alt={`Ưu đãi tháng 9 số ${index + 1}`} /><div><h3>ƯU ĐÃI THÁNG 9 HẤP DẪN</h3><p>Giảm đến 30% cho đơn đặt phòng đầu tiên khi bạn trải nghiệm và đặt homestay trên Tripio</p><button type="button" onClick={() => onDeveloping('Lưu voucher')}>Lưu voucher</button></div><button className="voucher-info" type="button" aria-label="Thông tin ưu đãi" onClick={() => onDeveloping('Thông tin ưu đãi')}>ⓘ</button></article>)}</div>
    </section>
    <br>
    </br>
    <section className="support-section"><div className="support-copy"><p>LUÔN ĐỒNG HÀNH CÙNG BẠN</p><h2>SẴN SÀNG GIẢI ĐÁP THẮC MẮC</h2></div><div className="support-actions"><a href="tel:0963508070"><span>☎</span><small>Hotline</small><b>0963 508 070</b></a><button onClick={() => onDeveloping('Nhắn tin tư vấn')}><span>☻</span><b>Nhắn tin tư vấn</b></button></div></section>

    <section className="guide-section page-section" id="news"><header><p className="kicker dark">CẨM NANG DU LỊCH</p><h2>Cập nhật xu hướng và điểm đến</h2></header><div className="post-grid">{posts.map(([title, image]) => <article key={title}><img src={image} alt="" /><small>30 Tháng 1, 2026</small><h3>{title}</h3><p>Khám phá những điểm đến và kinh nghiệm hữu ích để chuẩn bị cho chuyến đi sắp tới của bạn.</p><button onClick={() => onDeveloping('Cẩm nang du lịch')}>Xem thêm ↗</button></article>)}</div></section>

   

    <footer className="home-footer" id="footer"><div className="footer-newsletter"><div><h3>ĐĂNG KÝ NHẬN THÔNG TIN</h3><p>Luôn được cập nhật về các lời khuyên du lịch và khuyến mãi mới nhất</p></div><form onSubmit={(event) => { event.preventDefault(); onDeveloping('Đăng ký nhận thông tin'); }}><input type="email" placeholder="Nhập Email của bạn" /><button>Gửi ngay</button></form></div><div className="footer-columns"><div><a className="home-logo" href="#home">tripio</a><p>Tripio mang đến giải pháp đặt homestay tiện lợi, giúp bạn dễ dàng tìm kiếm không gian lưu trú.</p></div><div><h4>THÔNG TIN LIÊN HỆ</h4><p>140 Lê Trọng Tấn, Phường Tây Thạnh, TP. Hồ Chí Minh</p><p>Hotline: 0963 508 070</p><p>tripio@gmail.com</p></div><div><h4>CÁC CHÍNH SÁCH</h4><p>Chính sách đặt phòng</p><p>Chính sách thanh toán</p><p>Chính sách hủy phòng</p><p>Chính sách bảo mật</p></div></div><div className="footer-bottom"><p>© 2026 Copyright TRIPIO. All rights reserved</p><button onClick={onLogout}>Đăng xuất</button></div></footer>
  </div>;
}
