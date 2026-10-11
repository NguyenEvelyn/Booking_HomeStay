import React, { useEffect, useRef, useState } from 'react';
import { accountApi } from '../api/accountApi.js';
import './CustomerProfilePage.css';

function ProfileIcon({ name }) {
  const paths = {
    back: <path d="m15 18-6-6 6-6" />,
    camera: <><path d="M14.5 5 13 3h-2L9.5 5H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4.5Z"/><circle cx="12" cy="13" r="4"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    check: <path d="m5 12 4 4L19 6" />,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function CustomerProfilePage({ user, onBack, onChangePassword, onVerification, onUserChanged }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ fullName: '', phoneNumber: '', address: '', bio: '' });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    accountApi.profile().then((data) => {
      setProfile(data);
      setForm({ fullName: data.fullName || '', phoneNumber: data.phoneNumber || '', address: data.address || '', bio: data.bio || '' });
    }).catch((error) => setMessage({ type: 'error', text: error.message }));
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      const result = await accountApi.updateProfile(form);
      setProfile(result.profile);
      onUserChanged?.(result.profile);
      setEditing(false);
      setMessage({ type: 'success', text: result.message });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setBusy(false); }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setMessage(null);
    try {
      const result = await accountApi.uploadAvatar(file);
      setProfile((current) => ({ ...current, avatarUrl: result.url }));
      onUserChanged?.({ ...profile, avatarUrl: result.url });
      setMessage({ type: 'success', text: result.message });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setBusy(false); }
  };

  if (!profile) return <main className="customer-profile-page"><div className="profile-loading" role="status">Đang tải hồ sơ của bạn…</div></main>;

  return (
    <main className="customer-profile-page">
      <header className="customer-profile-topbar">
        <button type="button" onClick={onBack} aria-label="Quay lại"><ProfileIcon name="back" /></button>
        <img src="/assets/figma/tripio-logo-white.png" alt="Tripio" />
        <span />
      </header>

      <section className="customer-profile-shell">
        <div className="customer-profile-hero">
          <div className="customer-profile-avatar" style={profile.avatarUrl ? { backgroundImage: `url(${profile.avatarUrl})` } : undefined}>
            {!profile.avatarUrl && (profile.fullName?.charAt(0).toUpperCase() || 'U')}
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Thay ảnh đại diện"><ProfileIcon name="camera" /></button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} hidden />
          </div>
          <div><small>HỒ SƠ KHÁCH HÀNG</small><h1>{profile.fullName}</h1><p>Thành viên Tripio từ {new Date(profile.createdAt).getFullYear()}</p></div>
          <button className="profile-edit-button" type="button" onClick={() => setEditing((value) => !value)}><ProfileIcon name="edit" />{editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa hồ sơ'}</button>
        </div>

        {message && <p className={`profile-message ${message.type}`} role="status">{message.text}</p>}

        <div className="customer-profile-grid">
          <section className="profile-card profile-security-card">
            <div className="profile-card-heading"><div><span>TÀI KHOẢN & BẢO MẬT</span><h2>Bảo mật tài khoản</h2></div><i><ProfileIcon name="shield" /></i></div>
            <article className="security-row">
              <i><ProfileIcon name="mail" /></i><div><strong>Địa chỉ email</strong><span>{profile.email}</span></div>
              <em className={profile.emailVerified ? 'verified' : 'pending'}><ProfileIcon name={profile.emailVerified ? 'check' : 'mail'} />{profile.emailVerified ? 'Đã xác thực' : 'Chưa xác thực'}</em>
              <button type="button" onClick={() => onVerification?.('email', profile)}>Xác thực lại</button>
            </article>
            <article className="security-row">
              <i><ProfileIcon name="phone" /></i><div><strong>Số điện thoại</strong><span>{profile.phoneNumber || 'Chưa liên kết số điện thoại'}</span></div>
              <em className={profile.phoneVerified ? 'verified' : 'pending'}>{profile.phoneVerified ? 'Đã xác thực' : 'Chưa xác thực'}</em>
              <button type="button" onClick={() => onVerification?.('phone', profile)}>{profile.phoneNumber ? 'Xác thực lại' : 'Liên kết'}</button>
            </article>
            <article className="security-row">
              <i><ProfileIcon name="lock" /></i><div><strong>Mật khẩu</strong><span>••••••••••••</span></div>
              <button type="button" onClick={onChangePassword}>Thiết lập lại</button>
            </article>
          </section>

          <section className="profile-card profile-personal-card">
            <div className="profile-card-heading"><div><span>THÔNG TIN CÁ NHÂN</span><h2>Giới thiệu về bạn</h2></div><i><ProfileIcon name="user" /></i></div>
            {editing ? (
              <form className="customer-profile-form" onSubmit={save}>
                <label>Tên hiển thị<input required minLength="2" maxLength="100" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
                <label>Số điện thoại<input inputMode="tel" placeholder="0901 234 567" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} /></label>
                <label className="wide">Địa chỉ<input maxLength="255" placeholder="Thành phố, quốc gia" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
                <label className="wide">Giới thiệu<textarea rows="4" maxLength="1000" placeholder="Chia sẻ một chút về sở thích du lịch của bạn…" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label>
                <div className="profile-form-actions"><button type="button" onClick={() => setEditing(false)}>Hủy</button><button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
              </form>
            ) : (
              <div className="profile-details">
                <article><i><ProfileIcon name="user" /></i><div><small>Tên hiển thị</small><strong>{profile.fullName}</strong></div></article>
                <article><i><ProfileIcon name="location" /></i><div><small>Địa chỉ</small><strong>{profile.address || 'Chưa cập nhật'}</strong></div></article>
                <article className="wide"><div><small>Giới thiệu</small><p>{profile.bio || 'Hãy thêm vài dòng để Tripio cá nhân hóa trải nghiệm phù hợp với bạn.'}</p></div></article>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
