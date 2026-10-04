import React, { useState, useEffect } from 'react';

const logoWhite = '/assets/figma/tripio-logo-white.png';

export default function CustomerNav({
  active = 'homestays',
  user,
  onHome,
  onHomestays,
  onBookings,
  onAccount,
  transparentAtTop = false,
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!transparentAtTop) return;
    const updateMenu = () => setScrolled(window.scrollY > 24);
    updateMenu();
    window.addEventListener('scroll', updateMenu, { passive: true });
    return () => window.removeEventListener('scroll', updateMenu);
  }, [transparentAtTop]);

  const goHomeSection = (section) => {
    setMenuOpen(false);
    onHome();
    window.setTimeout(() => {
      const element = document.getElementById(section);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const navigate = (handler) => {
    setMenuOpen(false);
    handler?.();
  };

  return (
    <header className={`customer-nav-header${transparentAtTop ? ' has-transparent' : ''}${scrolled ? ' is-scrolled' : ''}`}>
      <nav className={`customer-nav${menuOpen ? ' menu-open' : ''}`}>
        <button className="customer-logo" type="button" onClick={() => navigate(onHome)} aria-label="Tripio Trang chủ">
          <img src={logoWhite} alt="tripio" />
        </button>

        <div className="customer-nav-links" id="customer-mobile-menu">
          <button type="button" className={active === 'home' ? 'active' : ''} onClick={() => navigate(onHome)}>Trang chủ</button>
          <button type="button" onClick={() => goHomeSection('about')}>Giới thiệu</button>
          <button type="button" onClick={() => goHomeSection('stays')}>Địa điểm</button>
          <button type="button" className={active === 'homestays' ? 'active' : ''} onClick={() => navigate(onHomestays)}>Homestay</button>
          <button type="button" onClick={() => goHomeSection('offers')}>Ưu đãi</button>
          <button type="button" onClick={() => goHomeSection('news')}>Tin tức</button>
        </div>

        <button
          className="customer-menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
          aria-controls="customer-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="customer-nav-actions">
          {user ? (
            <button
              type="button"
              className="customer-avatar-btn"
              onClick={onAccount}
              title={user.fullName || 'Tài khoản'}
              aria-label="Tài khoản"
            >
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </button>
          ) : (
            <button
              type="button"
              className="customer-icon-btn"
              onClick={onAccount}
              aria-label="Đăng nhập"
              title="Đăng nhập"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          )}

          {['Customer', 'Host'].includes(user?.role) && (
            <button
              type="button"
              className="customer-icon-btn"
              onClick={onBookings}
              title="Phòng đã đặt"
              aria-label="Phòng đã đặt"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </button>
          )}

          <button
            type="button"
            className="customer-icon-btn"
            aria-label="Yêu thích"
            title="Yêu thích"
            onClick={() => {}}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 0 1 12 6a5 5 0 0 1 7.5 6.6Z" />
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}
