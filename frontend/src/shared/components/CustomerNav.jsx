import React from 'react';

export default function CustomerNav({ active = 'home', user, onHome, onHomestays, onBookings, onAccount }) {
  const goHomeSection = (section) => {
    onHome();
    window.setTimeout(() => {
      const element = document.getElementById(section);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  };

  return <nav className="customer-nav">
    <button className="customer-logo" type="button" onClick={onHome}>tripio</button>
    <div className="customer-nav-links">
      <button className={active === 'home' ? 'active' : ''} onClick={onHome}>Trang chủ</button>
      <button onClick={() => goHomeSection('about')}>Giới thiệu</button>
      <button onClick={() => goHomeSection('stays')}>Địa điểm</button>
      <button className={active === 'homestays' ? 'active' : ''} onClick={onHomestays}>Homestay</button>
      <button onClick={() => goHomeSection('offers')}>Ưu đãi</button>
      <button onClick={() => goHomeSection('news')}>Tin tức</button>
    </div>
    <div className="customer-nav-actions">
      <button type="button" aria-label="Tài khoản" title={user?.fullName || 'Tài khoản'} onClick={onAccount}>♙</button>
      {['Customer','Host'].includes(user?.role) && <button type="button" aria-label="Đơn đặt phòng" title="Đơn đặt phòng của tôi" onClick={onBookings}>▣</button>}
    </div>
  </nav>;
}
