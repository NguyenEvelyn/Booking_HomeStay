import React, { useEffect, useState } from 'react';

const emptyForm = { fullName: '', identifier: '', email: '', phoneNumber: '', password: '', remember: false };

export default function AuthForm({ mode, onSubmit, busy, onDeveloping }) {
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setForm(emptyForm); setError(''); setShowPassword(false); }, [mode]);
  const update = ({ target }) => setForm((current) => ({ ...current, [target.name]: target.type === 'checkbox' ? target.checked : target.value }));
  const submit = (event) => {
    event.preventDefault();
    setError('');
    onSubmit(mode === 'login'
      ? { identifier: form.identifier, password: form.password, remember: form.remember }
      : { fullName: form.fullName, email: form.email, phoneNumber: form.phoneNumber, password: form.password, role: 'Customer' });
  };

  return <form onSubmit={submit} className="form">
    {mode === 'register' && <>
      <div className="field-row">
        <label>Họ và Tên<input name="fullName" value={form.fullName} onChange={update} minLength="2" maxLength="100" placeholder="Nhập họ và tên" required autoComplete="name" /></label>
        <label>Số điện thoại<input name="phoneNumber" type="tel" value={form.phoneNumber} onChange={update} pattern="[0-9+ ]{9,15}" placeholder="Nhập số điện thoại" required autoComplete="tel" /></label>
      </div>
      <label>Email<input name="email" type="email" value={form.email} onChange={update} placeholder="Nhập email" required autoComplete="email" /></label>
    </>}
    {mode === 'login' && <label>Email hoặc số điện thoại<input name="identifier" value={form.identifier} onChange={update} placeholder="Nhập email hoặc số điện thoại" required autoComplete="username" /></label>}
    <label>Mật khẩu<span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={update} minLength="8" maxLength="100" placeholder="Nhập mật khẩu" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" className="eye-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? '◉' : '◌'}</button></span></label>
    {mode === 'login' && <div className="form-options"><label className="check-label"><input name="remember" type="checkbox" checked={form.remember} onChange={update} /> Nhớ mật khẩu</label><button type="button" className="muted-link" onClick={() => onDeveloping('Quên mật khẩu')}>Quên mật khẩu?</button></div>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={busy}>{busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
  </form>;
}
