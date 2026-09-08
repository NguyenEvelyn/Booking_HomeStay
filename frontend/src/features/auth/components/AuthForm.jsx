import React, { useEffect, useState } from 'react';

const emptyForm = { fullName: '', identifier: '', email: '', phoneNumber: '', password: '', confirmPassword: '', verificationCode: '', remember: false };

export default function AuthForm({ mode, onSubmit, busy, onDeveloping }) {
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setForm(emptyForm); setError(''); setShowPassword(false); }, [mode]);
  const update = ({ target }) => setForm((current) => ({ ...current, [target.name]: target.type === 'checkbox' ? target.checked : target.value }));
  const submit = (event) => {
    event.preventDefault();
    setError('');
    if (mode === 'verify') return onSubmit({ code: form.verificationCode });
    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    onSubmit(mode === 'login'
      ? { identifier: form.identifier, password: form.password, remember: form.remember }
      : { fullName: form.fullName, email: form.email, phoneNumber: form.phoneNumber, password: form.password, confirmPassword: form.confirmPassword, role: 'Customer' });
  };

  return <form onSubmit={submit} className="form">
    {mode === 'verify' && <label>Mã OTP xác minh email<input name="verificationCode" inputMode="numeric" value={form.verificationCode} onChange={update} pattern="[0-9]{6}" minLength="6" maxLength="6" placeholder="Nhập mã OTP gồm 6 chữ số" required autoComplete="one-time-code" /></label>}
    {mode === 'register' && <>
      <div className="field-row">
        <label>Họ và Tên<input name="fullName" value={form.fullName} onChange={update} minLength="2" maxLength="100" placeholder="Nhập họ và tên" required autoComplete="name" /></label>
        <label>Số điện thoại<input name="phoneNumber" type="tel" value={form.phoneNumber} onChange={update} pattern="(0|\+84)(3|5|7|8|9)[0-9]{8}" title="Nhập số điện thoại Việt Nam hợp lệ, ví dụ 0912345678" placeholder="Nhập số điện thoại" required autoComplete="tel" /></label>
      </div>
      <label>Email<input name="email" type="email" value={form.email} onChange={update} placeholder="Nhập email" required autoComplete="email" /></label>
    </>}
    {mode === 'login' && <label>Email hoặc Số điện thoại<input name="identifier" value={form.identifier} onChange={update} placeholder="Nhập email hoặc Số điện thoại" required autoComplete="username" /></label>}
    {mode !== 'verify' && <label>Mật khẩu<span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={update} minLength="6" maxLength="32" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{6,32}" title="Mật khẩu 6–32 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt" placeholder="Nhập mật khẩu" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" className="eye-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? '◉' : '◌'}</button></span></label>}
    {mode === 'register' && <label>Xác nhận mật khẩu<input name="confirmPassword" type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={update} minLength="6" maxLength="32" placeholder="Nhập lại mật khẩu" required autoComplete="new-password" /></label>}
    {mode === 'login' && <div className="form-options"><label className="check-label"><input name="remember" type="checkbox" checked={form.remember} onChange={update} /> Nhớ mật khẩu</label><button type="button" className="muted-link" onClick={() => onDeveloping('Quên mật khẩu')}>Quên mật khẩu?</button></div>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={busy}>{busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : mode === 'verify' ? 'Xác minh tài khoản' : 'Tạo tài khoản'}</button>
  </form>;
}
