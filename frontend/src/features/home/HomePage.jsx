import React from 'react';
import villaImage from '../../../assets/Frame 488 (1).jpg';
import islandStayImage from '../../../assets/Frame 496.jpg';
import poolStayImage from '../../../assets/Frame 496 (1).jpg';

const stays = [
  { name: 'The Coastal Haven', location: 'Phú Yên, Việt Nam', price: '1,009k VNĐ', image: islandStayImage },
  { name: 'Ocean Crest Residence', location: 'Quy Nhơn, Việt Nam', price: '2,559k VNĐ', image: villaImage },
  { name: 'The Sunset Residence', location: 'Hội An, Việt Nam', price: '1,456k VNĐ', image: poolStayImage }
];

export default function HomePage({ user, onLogout, onDeveloping }) {
  return <div className="home-page">
    <section className="hero" id="home">
      <nav className="home-nav">
        <a className="home-logo" href="#home">tripio</a>
        <div className="nav-links">
          <a className="active" href="#home">Trang chủ</a><a href="#about">Giới thiệu</a><a href="#stays">Địa điểm</a><a href="#stays">Homestay</a><a href="#offers">Ưu đãi</a><a href="#footer">Tin tức</a>
        </div>
        <div className="nav-actions"><button type="button" aria-label="Tìm kiếm" onClick={() => onDeveloping('Tìm kiếm nhanh')}>⌕</button><span className="user-chip">{user.fullName.split(' ').slice(-1)[0]}</span><button type="button" onClick={onLogout} title="Đăng xuất">↗</button></div>
      </nav>
      <div className="hero-shade" />
      <div className="hero-content">
        <h1><strong>FIND YOUR</strong> PERFECT STAY</h1>
        <p>Khám phá những không gian lưu trú tuyệt vời, từ những căn homestay ấm cúng đến các điểm nghỉ dưỡng sang trọng.</p>
      </div>
      <div className="hero-picks">
        <article><img src={islandStayImage} alt="Ocean Breeze" /><span>Ocean Breeze Private<br />Retreat</span><b>↗</b></article>
        <article><img src={poolStayImage} alt="Whispering Pines" /><span>The Whispering Pines<br />Retreat</span><b>↗</b></article>
      </div>
    </section>

    <form className="search-bar" onSubmit={(event) => { event.preventDefault(); onDeveloping('Tìm phòng'); }}>
      <label>Địa điểm hoặc tên khách sạn<input placeholder="Bạn muốn đến đâu?" /></label>
      <label>Ngày nhận<input type="date" /></label><label>Ngày trả<input type="date" /></label>
      <label>Khách và phòng<select defaultValue=""><option value="" disabled>Chọn số người</option><option>1 khách · 1 phòng</option><option>2 khách · 1 phòng</option><option>Gia đình · 2 phòng</option></select></label>
      <button>Tìm phòng</button>
    </form>

    <section className="about-section page-section" id="about">
      <div className="about-image"><img src={villaImage} alt="Biệt thự nghỉ dưỡng Tripio" /><span>TRIPIO</span><small>Nơi những chuyến đi bắt đầu</small></div>
      <div className="about-copy"><p className="kicker">VỀ CHÚNG TÔI</p><h2>CÙNG TRIPIO KẾT NỐI NHỮNG<br />HÀNH TRÌNH <em>ĐÁNG NHỚ</em></h2>
        <p>Tripio là nền tảng đặt phòng homestay trực tuyến, giúp bạn dễ dàng tìm kiếm, khám phá và lựa chọn không gian lưu trú phù hợp cho mỗi chuyến đi.</p>
        <div className="trust-row"><div className="avatars"><i /><i /><i /></div><span><b>Tin tưởng bởi</b><br />900+ khách hàng</span><span><b>4.8 ⭐⭐⭐⭐⭐</b><br />600+ lượt đánh giá</span></div>
        <div className="stats"><div><b>1000+</b><span>Chỗ ở chất lượng</span></div><div><b>50+</b><span>Điểm đến hấp dẫn</span></div><div><b>98%</b><span>Khách hàng hài lòng</span></div><div><b>2000+</b><span>Lượt đặt thành công</span></div></div>
      </div>
    </section>

    <section className="stays-section page-section" id="stays">
      <div className="stays-intro"><p className="kicker dark">DÀNH CHO BẠN</p><h2>HOMESTAY ĐƯỢC<br /><em>YÊU THÍCH</em></h2><p>Khám phá các homestay được nhiều du khách yêu thích và lựa chọn cho hành trình đáng nhớ.</p><button type="button" onClick={() => onDeveloping('Xem tất cả homestay')}>Xem tất cả <span>↗</span></button></div>
      <div className="stay-grid">{stays.map((stay) => <article className="stay-card" key={stay.name} style={{ backgroundImage: `linear-gradient(180deg,transparent 35%,rgba(3,31,45,.86)),url('${stay.image}')` }}>
        <div className="stay-top"><span>⌖ {stay.location}</span><button type="button" aria-label="Yêu thích" onClick={() => onDeveloping('Yêu thích homestay')}>♡</button></div>
        <div><h3>{stay.name}</h3><p>Khám phá điểm dừng chân hoàn hảo với trải nghiệm nghỉ dưỡng tiện nghi.</p><footer><b>{stay.price}</b><button type="button" onClick={() => onDeveloping('Đặt phòng')}>Đặt phòng</button></footer></div>
      </article>)}</div>
    </section>

    <section className="cta-section" id="offers"><p className="kicker">BẮT ĐẦU HÀNH TRÌNH</p><h2>ĐẶT <em>HOMESTAY</em> DỄ DÀNG VÀ KHÁM PHÁ<br />NHIỀU HƠN CÙNG <em>TRIPIO</em></h2><button type="button" onClick={() => onDeveloping('Đặt phòng')}>Đặt phòng ngay <span>↗</span></button></section>
    <footer className="home-footer" id="footer"><a className="home-logo" href="#home">tripio</a><p>© 2026 Tripio · Nơi mọi hành trình đáng nhớ bắt đầu.</p><button onClick={onLogout}>Đăng xuất</button></footer>
  </div>;
}
