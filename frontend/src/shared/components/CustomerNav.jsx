import React, { useState, useEffect, useRef } from 'react';
import './CustomerAccountMenu.css';

const logoWhite = '/assets/figma/tripio-logo-white.png';

export default function CustomerNav({
  active = 'homestays',
  user,
  onHome,
  onHomestays,
  onBookings,
  onFavorites,
  onAccount,
  onChangePassword,
  onLogout,
  transparentAtTop = false,
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);

  useEffect(() => {
    const close = (event) => { if (!accountRef.current?.contains(event.target)) setAccountOpen(false); };
    const key = (event) => { if (event.key === 'Escape') setAccountOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
  }, []);

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
    setAccountOpen(false);
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
            <div className="customer-account-wrap" ref={accountRef}><button
              type="button"
              className="customer-avatar-btn"
              onClick={() => setAccountOpen(open => !open)}
              title={user.fullName || 'Tài khoản'}
              aria-label="Tài khoản"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
            >
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </button>{accountOpen&&<div className="customer-account-menu" role="menu"><header><span>{user.fullName?.charAt(0).toUpperCase()||'U'}</span><div><b>{user.fullName}</b><small>{user.email}</small></div></header><button role="menuitem" onClick={()=>navigate(onAccount)}>Hồ sơ của tôi</button><button role="menuitem" onClick={()=>navigate(onBookings)}>Đơn đặt phòng</button><button role="menuitem" onClick={()=>navigate(onFavorites)}>Danh sách yêu thích</button><button role="menuitem" onClick={()=>navigate(onChangePassword)}>Đổi mật khẩu</button><button className="logout" role="menuitem" onClick={()=>navigate(onLogout)}>Đăng xuất</button></div>}</div>
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
              title="Chuyến đi của tôi"
              aria-label="Chuyến đi của tôi"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </button>
          )}

          <button
            type="button"
            className={`customer-icon-btn${active === 'favorites' ? ' active' : ''}`}
            aria-label="Yêu thích"
            title="Yêu thích"
            onClick={() => navigate(onFavorites)}
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
