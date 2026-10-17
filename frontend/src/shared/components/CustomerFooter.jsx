import React from 'react';

const logoWhite = '/assets/figma/tripio-logo-white.png';

export default function CustomerFooter({ onHome, onDeveloping = () => {} }) {
  return (
    <footer className="home-footer customer-shared-footer">
      <div className="footer-newsletter">
        <div className="footer-newsletter-text">
          <h3>ĐĂNG KÝ NHẬN THÔNG TIN</h3>
          <p>Luôn được cập nhật về các lời khuyên du lịch và khuyến mãi mới nhất</p>
        </div>
        <form className="footer-newsletter-form" onSubmit={(event) => { event.preventDefault(); onDeveloping('Đăng ký nhận thông tin'); }}>
          <input type="email" placeholder="Nhập Email của bạn" required />
          <button type="submit">Gửi ngay</button>
        </form>
      </div>
      <div className="footer-columns">
        <div className="footer-col footer-col-brand">
          <button type="button" className="footer-logo footer-logo-button" onClick={onHome}><img src={logoWhite} alt="tripio" /></button>
          <p>Tripio mang đến giải pháp đặt homestay tiện lợi, giúp bạn dễ dàng tìm kiếm không gian lưu trú.</p>
        </div>
        <div className="footer-col footer-col-contact">
          <h4>THÔNG TIN LIÊN HỆ</h4><div className="footer-title-bar" />
          <div className="footer-contact-list">
            <div className="footer-contact-item"><span>⌖</span><span>140 Lê Trọng Tấn, Phường Tây Thạnh,<br />TP. Hồ Chí Minh</span></div>
            <div className="footer-contact-item"><span>☎</span><span>Hotline: <b>0963 508 070</b></span></div>
            <div className="footer-contact-item"><span>✉</span><span>tripio@gmail.com</span></div>
          </div>
        </div>
        <div className="footer-col footer-col-links">
          <h4>CÁC CHÍNH SÁCH</h4><div className="footer-title-bar" />
          <div className="footer-link-list">
            {['Chính sách đặt phòng', 'Chính sách thanh toán', 'Chính sách hủy phòng', 'Chính sách hoàn tiền', 'Chính sách bảo mật'].map((label) => (
              <a key={label} href="#policy" onClick={(event) => { event.preventDefault(); onDeveloping(label); }}>{label}</a>
            ))}
          </div>
        </div>
        <div className="footer-col footer-col-fanpage">
          <h4>TRIPIO</h4><div className="footer-title-bar" />
          <p>Đặt chỗ an toàn, hỗ trợ nhanh chóng và đồng hành trong suốt chuyến đi của bạn.</p>
        </div>
      </div>
      <div className="footer-bottom"><p>© 2026 Copyright TRIPIO. All rights reserved</p></div>
    </footer>
  );
}
