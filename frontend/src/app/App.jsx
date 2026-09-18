import React, { useEffect, useState } from 'react';
import AuthForm from '../features/auth/components/AuthForm.jsx';
import { authApi } from '../features/auth/api/authApi.js';
import HomePage from '../features/home/HomePage.jsx';
import DevelopmentDialog from '../shared/components/DevelopmentDialog.jsx';
import ErrorPage from '../shared/components/ErrorPage.jsx';
import CustomerHomestaysPage from '../features/homestays/pages/CustomerHomestaysPage.jsx';
import HomestayDetailPage from '../features/homestays/pages/HomestayDetailPage.jsx';
import HostDashboardPage from '../features/homestays/pages/HostDashboardPage.jsx';
import MyBookingsPage from '../features/bookings/pages/MyBookingsPage.jsx';
import AdminDashboardPage from '../features/admin/pages/AdminDashboardPage.jsx';


export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [developingFeature, setDevelopingFeature] = useState('');
  const [showHome, setShowHome] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [view, setView] = useState('home');
  const [selectedHomestayId, setSelectedHomestayId] = useState(null);
  const [homestaySearch, setHomestaySearch] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const errorCode = Number(window.location.pathname.slice(1));
  const isErrorPage = [400, 401, 403, 404, 500].includes(errorCode) || !['/', ''].includes(window.location.pathname);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('payment')) {
      const status = params.get('payment');
      setPaymentResult({ success: status === 'success', code: params.get('bookingCode'), status });
      window.history.replaceState({}, '', window.location.pathname);
    }
    authApi.me().then(({ user: currentUser }) => {
      setUser(currentUser);
      if (params.has('auth')) window.history.replaceState({}, '', window.location.pathname);
    }).catch(() => {
      if (params.get('auth') === 'error') setNotice({ type: 'error', text: 'Đăng nhập mạng xã hội không thành công.' });
      if (params.get('auth') === 'locked') setNotice({ type: 'error', text: 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.' });
    });
  }, []);
  const switchMode = () => { setMode((current) => current === 'login' ? 'register' : 'login'); setNotice(null); };
  const submit = async (form) => {
    setBusy(true); setNotice(null);
    try {
      if (mode === 'verify') {
        const result = await authApi.verifyEmail({ email: pendingEmail, code: form.code });
        setMode('login');
        setNotice({ type: 'success', text: result.message });
        return;
      }
      if (mode === 'forgot') {
        const result = await authApi.forgotPassword(form);
        setPendingEmail(form.email);
        setMode('reset');
        setNotice({ type: 'success', text: result.message });
        return;
      }
      if (mode === 'reset') {
        const result = await authApi.resetPassword({ ...form, email: pendingEmail });
        setMode('login');
        setNotice({ type: 'success', text: result.message });
        return;
      }
      if (mode === 'change-password') {
        const result = await authApi.changePassword(form);
        setUser(null);
        setMode('login');
        setNotice({ type: 'success', text: result.message });
        return;
      }
      const result = mode === 'login' ? await authApi.login(form) : await authApi.register(form);
      if (mode === 'login') { setUser(result.user); setView(result.user.role === 'Host' ? 'host' : result.user.role === 'Admin' ? 'admin' : 'home'); setNotice({ type: 'success', text: result.message }); }
      else {
        setPendingEmail(form.email);
        setMode('verify');
        setNotice({ type: 'success', text: result.message });
      }
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };
  const resendVerification = async () => {
    setBusy(true); setNotice(null);
    try {
      const result = await authApi.resendVerification({ email: pendingEmail });
      setNotice({ type: 'success', text: result.message });
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    try { const result = await authApi.logout(); setNotice({ type: 'success', text: result.message }); }
    catch { setNotice({ type: 'success', text: 'Đã đăng xuất.' }); }
    finally { setUser(null); }
  };
  const goHome = () => { window.history.pushState({}, '', '/'); setMode('login'); setShowHome(true); };
  const showDeveloping = (feature) => {
    if (feature === 'forgot-password') { setMode('forgot'); setNotice(null); return; }
    setDevelopingFeature(feature);
  };
  const dialog = <><DevelopmentDialog open={Boolean(developingFeature)} feature={developingFeature} onClose={() => setDevelopingFeature('')} />{paymentResult && <div className={`payment-result-toast ${paymentResult.success ? 'success' : 'error'}`} role="status"><button onClick={() => setPaymentResult(null)}>×</button><strong>{paymentResult.success ? 'Thanh toán VNPay thành công!' : 'Thanh toán chưa thành công'}</strong><span>{paymentResult.success ? `Đơn ${paymentResult.code || ''} đã được xác nhận.` : 'Giao dịch đã bị hủy, thất bại hoặc không hợp lệ.'}</span></div>}</>;
  const openCatalog = () => setView('catalog');
  const openHomestay = (id, searchCriteria = null) => { setSelectedHomestayId(id); setHomestaySearch(searchCriteria); setView('detail'); };

  if (isErrorPage) return <ErrorPage code={[400, 401, 403, 404, 500].includes(errorCode) ? errorCode : 404} onHome={goHome} />;

  if (user && mode !== 'change-password') {
    if (user.role === 'Admin') return <><AdminDashboardPage user={user} onLogout={logout} onChangePassword={() => { setMode('change-password'); setNotice(null); }} />{dialog}</>;
    if (user.role === 'Host' && view === 'host') return <><HostDashboardPage user={user} onLogout={logout} onCustomerMode={() => setView('home')} onChangePassword={() => { setMode('change-password'); setNotice(null); }} onDeveloping={showDeveloping} />{dialog}</>;
    if (view === 'bookings') return <><MyBookingsPage user={user} onHome={() => setView('home')} onHomestays={openCatalog} onAccount={() => { setMode('change-password'); setNotice(null); }} />{dialog}</>;
    if (view === 'catalog') return <><CustomerHomestaysPage user={user} onBack={() => setView('home')} onOpen={openHomestay} onBookings={() => setView('bookings')} onAccount={() => { setMode('change-password'); setNotice(null); }} />{dialog}</>;
    if (view === 'detail') return <><HomestayDetailPage id={selectedHomestayId} initialSearch={homestaySearch} user={user} onHome={() => setView('home')} onBack={openCatalog} onBookings={() => setView('bookings')} onAccount={() => { setMode('change-password'); setNotice(null); }} onDeveloping={showDeveloping} />{dialog}</>;
    return <><HomePage user={user} onLogout={logout} onChangePassword={() => { setMode('change-password'); setNotice(null); }} onBrowseHomestays={openCatalog} onOpenHomestay={openHomestay} onDeveloping={showDeveloping} />{user.role==='Host'&&<button className="return-host-portal" onClick={()=>setView('host')}>⌂ Về trang quản lý Host</button>}{dialog}</>;
  }

  if (showHome) {
    if (view === 'catalog') return <><CustomerHomestaysPage onBack={() => setView('home')} onOpen={openHomestay} onAccount={() => setShowHome(false)} />{dialog}</>;
    if (view === 'detail') return <><HomestayDetailPage id={selectedHomestayId} initialSearch={homestaySearch} onHome={() => setView('home')} onBack={openCatalog} onAccount={() => setShowHome(false)} onDeveloping={showDeveloping} />{dialog}</>;
    return <><HomePage user={{ fullName: 'Khách' }} onLogout={() => setShowHome(false)} onChangePassword={() => setShowHome(false)} onBrowseHomestays={openCatalog} onOpenHomestay={openHomestay} onDeveloping={showDeveloping} />{dialog}</>;
  }

  return <main className="auth-page"><section className="auth-shell" aria-label="Xác thực tài khoản Tripio">
    <aside className="auth-visual">
      <a className="logo" href="/" aria-label="Tripio - trang chủ" onClick={(event) => { event.preventDefault(); goHome(); }}>tripio</a>
      <a className="home-link" href="/" onClick={(event) => { event.preventDefault(); goHome(); }}>Về trang chủ <span>→</span></a>
      <div className="visual-caption"><p>Nơi Mọi Hành Trình<br />Đáng Nhớ Bắt Đầu</p><div className="slides"><i /><i /><i /><i /></div></div>
    </aside>
    <div className="auth-content">
      <>
        <header className="form-header"><h1>{mode === 'login' ? 'Đăng nhập vào tài khoản' : mode === 'verify' ? 'Xác minh tài khoản' : mode === 'forgot' ? 'Đặt lại mật khẩu' : mode === 'reset' ? 'Tạo mật khẩu mới' : mode === 'change-password' ? 'Đổi mật khẩu' : 'Tạo tài khoản'}</h1>
          <p>{mode === 'verify' ? `Mã OTP đã được gửi đến ${pendingEmail}` : mode === 'forgot' ? 'Nhập email và chúng tôi sẽ gửi mã OTP đặt lại mật khẩu.' : mode === 'reset' ? `Nhập mã OTP đã gửi đến ${pendingEmail} và tạo mật khẩu mới.` : mode === 'change-password' ? 'Nhập mật khẩu hiện tại và mật khẩu mới của bạn.' : <>{mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}<button className="text-button" type="button" onClick={switchMode}>{mode === 'login' ? 'Đăng ký' : 'Đăng nhập'}</button></>}</p>
        </header>
        <AuthForm mode={mode} onSubmit={submit} busy={busy} onDeveloping={showDeveloping} />
        {mode === 'verify' && <button className="resend-button" type="button" disabled={busy} onClick={resendVerification}>Gửi lại mã OTP</button>}
        {(mode === 'forgot' || mode === 'reset') && <button className="resend-button" type="button" disabled={busy} onClick={() => { setMode('login'); setNotice(null); }}>Quay lại đăng nhập</button>}
        {mode === 'change-password' && <button className="resend-button" type="button" disabled={busy} onClick={() => { setMode('login'); setNotice(null); }}>Hủy và về trang chủ</button>}
        {notice && <p className={`notice ${notice.type}`} role="status">{notice.text}</p>}
        {(mode === 'login' || mode === 'register') && <><div className="divider"><span>Hoặc</span></div>
        <div className="social-row" aria-label="Đăng nhập mạng xã hội">
          <button type="button" className="social-button" onClick={() => authApi.externalLogin('facebook')}><b className="facebook">f</b> Facebook</button>
          <button type="button" className="social-button" onClick={() => authApi.externalLogin('google')}><b className="google">G</b> Google</button>
        </div></>}
      </>
    </div>
  </section>{dialog}</main>;
}
