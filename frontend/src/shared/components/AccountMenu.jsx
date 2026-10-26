import React from 'react';
import './AccountMenu.css';

const icons = {
  homePlus: <><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-6h6v6" /><path d="M18 3v5M15.5 5.5h5" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  suitcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 12v3M16 12v3M3 13h18" /></>,
  heart: <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 0 1 12 6a5 5 0 0 1 7.5 6.6Z" />,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></>,
  arrowUpRight: <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>
};
const Icon = ({ name }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;

// The one account menu used by the home page and every customer page (CustomerNav), so it looks and behaves the same.
export default function AccountMenu({ user, onClose, onHostPortal, onAdminPortal, onBookings, onFavorites, onProfile, onChangePassword, onRegisterHost, onLogout }) {
  const pick = (handler) => () => { onClose?.(); handler?.(); };
  const Item = ({ icon, title, hint, onClick, className = '' }) => (
    <button type="button" role="menuitem" className={`account-menu__item ${className}`} onClick={pick(onClick)}>
      <i><Icon name={icon} /></i>
      <span><b>{title}</b>{hint && <small>{hint}</small>}</span>
    </button>
  );
  const isStaff = user.role === 'Admin' || user.role === 'Support';

  return (
    <div className="account-menu" role="menu" aria-label="Menu tài khoản">
      <div className="account-menu__identity">
        <span className="account-menu__avatar" aria-hidden="true">{user.fullName?.charAt(0).toUpperCase() || 'U'}</span>
        <div>
          <strong>{user.fullName}</strong>
          <span>{user.email || user.role}</span>
        </div>
      </div>

      {user.role === 'Host' && onHostPortal && <Item icon="homePlus" title="Quản lý Homestay" hint="Đi đến trung tâm đối tác" onClick={onHostPortal} className="is-primary" />}
      {isStaff && onAdminPortal && <Item icon="shield" title="Trang quản trị" hint="Quản lý hệ thống Tripio" onClick={onAdminPortal} className="is-primary" />}
      <Item icon="suitcase" title="Chuyến đi của tôi" hint="Xem và quản lý các kỳ lưu trú" onClick={onBookings} />
      <Item icon="heart" title="Danh sách yêu thích" hint="Những nơi bạn đã lưu" onClick={onFavorites} />
      <Item icon="profile" title="Hồ sơ của tôi" hint="Thông tin và tùy chọn cá nhân" onClick={onProfile} />
      <Item icon="lock" title="Đổi mật khẩu" hint="Bảo mật tài khoản của bạn" onClick={onChangePassword} />

      {user.role === 'Customer' && onRegisterHost && (
        <section className="account-menu__host-card" aria-label="Đăng ký cơ sở lưu trú">
          <span className="account-menu__host-orbit" aria-hidden="true" />
          <small>TRỞ THÀNH ĐỐI TÁC TRIPIO</small>
          <strong>Biến không gian của bạn thành một hành trình đáng nhớ.</strong>
          <button type="button" role="menuitem" onClick={pick(onRegisterHost)}>
            <span>Đăng ký cho thuê nhà</span>
            <Icon name="arrowUpRight" />
          </button>
        </section>
      )}

      <Item icon="logout" title="Đăng xuất" onClick={onLogout} className="is-logout" />
    </div>
  );
}
