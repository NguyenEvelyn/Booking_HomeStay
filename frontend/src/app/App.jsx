import { useEffect, useState } from 'react';
import AuthForm from '../features/auth/components/AuthForm.jsx';
import { authApi } from '../features/auth/api/authApi.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { authApi.me().then(({ user }) => setUser(user)).catch(() => {}); }, []);
  const submit = async (form) => {
    setBusy(true); setMessage('');
    try {
      const result = mode === 'login' ? await authApi.login(form) : await authApi.register(form);
      setMessage(result.message);
      if (mode === 'login') setUser(result.user); else setMode('login');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const logout = async () => { const result = await authApi.logout(); setUser(null); setMessage(result.message); };

  return <main><section className="card">
    <div className="brand">HOMESTAY</div>
    {user ? <div className="welcome"><h1>Xin chào, {user.fullName}</h1><p>{user.email} · Vai trò: {user.role}</p><button onClick={logout}>Đăng xuất</button></div> : <>
      <h1>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
      <AuthForm mode={mode} onSubmit={submit} busy={busy} />
      <button className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); }}>
        {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
      </button>
    </>}
    {message && <p className="message">{message}</p>}
  </section></main>;
}
