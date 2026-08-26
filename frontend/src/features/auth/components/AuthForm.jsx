import { useState } from 'react';

export default function AuthForm({ mode, onSubmit, busy }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'Customer' });
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = (event) => { event.preventDefault(); onSubmit(form); };

  return <form onSubmit={submit} className="form">
    {mode === 'register' && <label>Họ và tên<input name="fullName" value={form.fullName} onChange={update} minLength="2" required autoComplete="name" /></label>}
    {mode === 'register' && <label>Loại tài khoản<select name="role" value={form.role} onChange={update}>
      <option value="Customer">Khách thuê</option>
      <option value="Host">Chủ homestay</option>
    </select></label>}
    <label>Email<input name="email" type="email" value={form.email} onChange={update} required autoComplete="email" /></label>
    <label>Mật khẩu<input name="password" type="password" value={form.password} onChange={update} minLength="8" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
    <button disabled={busy}>{busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</button>
  </form>;
}
