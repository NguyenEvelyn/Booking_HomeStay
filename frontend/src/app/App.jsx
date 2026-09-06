import React, { useEffect, useState } from 'react';
import AuthForm from '../features/auth/components/AuthForm.jsx';
import { authApi } from '../features/auth/api/authApi.js';
import HomePage from '../features/home/HomePage.jsx';
import DevelopmentDialog from '../shared/components/DevelopmentDialog.jsx';
import ErrorPage from '../shared/components/ErrorPage.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [developingFeature, setDevelopingFeature] = useState('');
  const errorCode = Number(window.location.pathname.slice(1));
  const isErrorPage = [400, 401, 403, 404, 500].includes(errorCode) || !['/', ''].includes(window.location.pathname);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    authApi.me().then(({ user: currentUser }) => {
      setUser(currentUser);
      if (params.has('auth')) window.history.replaceState({}, '', window.location.pathname);
    }).catch(() => {
      if (params.get('auth') === 'error') setNotice({ type: 'error', text: 'Đăng nhập mạng xã hội không thành công.' });
    });
  }, []);
  const switchMode = () => { setMode((current) => current === 'login' ? 'register' : 'login'); setNotice(null); };
  const submit = async (form) => {
    setBusy(true); setNotice(null);
    try {
      const result = mode === 'login' ? await authApi.login(form) : await authApi.register(form);
      if (mode === 'login') { setUser(result.user); setNotice({ type: 'success', text: result.message }); }
      else { setMode('login'); setNotice({ type: 'success', text: 'Đăng ký thành công. Bạn có thể đăng nhập ngay.' }); }
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };
  const logout = async () => { const result = await authApi.logout(); setUser(null); setNotice({ type: 'success', text: result.message }); };
  const goHome = () => { window.history.pushState({}, '', '/'); window.location.reload(); };
  const showDeveloping = (feature) => setDevelopingFeature(feature);
  const dialog = <DevelopmentDialog open={Boolean(developingFeature)} feature={developingFeature} onClose={() => setDevelopingFeature('')} />;

  if (isErrorPage) return <ErrorPage code={[400, 401, 403, 404, 500].includes(errorCode) ? errorCode : 404} onHome={goHome} />;

  if (user) return <><HomePage user={user} onLogout={logout} onDeveloping={showDeveloping} />{dialog}</>;

  return <main className="auth-page"><section className="auth-shell" aria-label="Xác thực tài khoản Tripio">
    <aside className="auth-visual">
      <a className="logo" href="/" aria-label="Tripio - trang chủ">tripio</a>
      <a className="home-link" href="/">Về trang chủ <span>→</span></a>
      <div className="visual-caption"><p>Nơi Mọi Hành Trình<br />Đáng Nhớ Bắt Đầu</p><div className="slides"><i /><i /><i /><i /></div></div>
    </aside>
    <div className="auth-content">
      <>
        <header className="form-header"><h1>{mode === 'login' ? 'Đăng nhập vào tài khoản' : 'Tạo tài khoản'}</h1>
          <p>{mode === 'login' ? 'Chưa có tài khoản?' : 'Bạn đã có tài khoản?'}{' '}<button className="text-button" type="button" onClick={switchMode}>{mode === 'login' ? 'Đăng ký' : 'Đăng nhập'}</button></p>
        </header>
        <AuthForm mode={mode} onSubmit={submit} busy={busy} onDeveloping={showDeveloping} />
        {notice && <p className={`notice ${notice.type}`} role="status">{notice.text}</p>}
        <div className="divider"><span>Hoặc</span></div>
        <div className="social-row" aria-label="Đăng nhập mạng xã hội">
          <button type="button" className="social-button" onClick={() => authApi.externalLogin('facebook')}><b className="facebook">f</b> Facebook</button>
          <button type="button" className="social-button" onClick={() => authApi.externalLogin('google')}><b className="google">G</b> Google</button>
        </div>
      </>
    </div>
  </section>{dialog}</main>;
}
