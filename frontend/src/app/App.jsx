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
  const [showHome, setShowHome] = useState(true);
  const [pendingEmail, setPendingEmail] = useState('');

  const [view, setView] = useState('home');
  const [selectedHomestayId, setSelectedHomestayId] = useState(null);
  const [homestaySearch, setHomestaySearch] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  const errorCode = Number(window.location.pathname.slice(1));
  const isErrorPage =
    [400, 401, 403, 404, 500].includes(errorCode) ||
    !['/', ''].includes(window.location.pathname);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.has('payment')) {
      const status = params.get('payment');
      setPaymentResult({
        success: status === 'success',
        code: params.get('bookingCode'),
        status,
      });
      window.history.replaceState({}, '', window.location.pathname);
    }

    authApi
      .me()
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        if (params.has('auth')) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch(() => {
        if (params.get('auth') === 'error') {
          setNotice({
            type: 'error',
            text: 'Đăng nhập mạng xã hội không thành công.',
          });
        }
        if (params.get('auth') === 'locked') {
          setNotice({
            type: 'error',
            text: 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.',
          });
        }
      });
  }, []);

  const switchMode = () => {
    setMode((current) => (current === 'login' ? 'register' : 'login'));
    setNotice(null);
    setDevelopingFeature('');
  };

  const forgotPassword = () => {
    setMode('forgot');
    setNotice(null);
    setDevelopingFeature('');
    setPendingEmail('');
  };

  const socialLogin = (provider) => {
    if (typeof authApi.externalLogin !== 'function') {
      setNotice({
        type: 'error',
        text: 'Chức năng đăng nhập mạng xã hội chưa được cấu hình trong authApi.',
      });
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      const result = authApi.externalLogin(provider);
      if (typeof result === 'string') {
        window.location.href = result;
        return;
      }
    } catch (error) {
      setBusy(false);
      setNotice({
        type: 'error',
        text: error?.message || 'Đăng nhập mạng xã hội không thành công.',
      });
    }
  };

  const submit = async (form) => {
    setBusy(true);
    setNotice(null);

    try {
      if (mode === 'verify') {
        const result = await authApi.verifyEmail({
          email: pendingEmail,
          code: form.code || form.verificationCode,
        });
        setMode('login');
        setNotice({
          type: 'success',
          text: result?.message || 'Xác minh tài khoản thành công. Vui lòng đăng nhập.',
        });
        return;
      }

      if (mode === 'forgot') {
        if (typeof authApi.forgotPassword !== 'function') {
          setNotice({
            type: 'error',
            text: 'Chức năng quên mật khẩu chưa sẵn sàng.',
          });
          return;
        }
        const result = await authApi.forgotPassword(form);
        setPendingEmail(form.email);
        setMode('reset');
        setNotice({
          type: 'success',
          text: result?.message || 'Mã OTP đã được gửi đến email của bạn.',
        });
        return;
      }

      if (mode === 'reset') {
        if (typeof authApi.resetPassword !== 'function') {
          setNotice({
            type: 'error',
            text: 'Chức năng đặt lại mật khẩu chưa sẵn sàng.',
          });
          return;
        }
        const result = await authApi.resetPassword({
          ...form,
          email: pendingEmail,
          code: form.code || form.verificationCode,
        });
        setMode('login');
        setNotice({
          type: 'success',
          text: result?.message || 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.',
        });
        return;
      }

      if (mode === 'change-password') {
        if (typeof authApi.changePassword !== 'function') {
          setNotice({
            type: 'error',
            text: 'Chức năng đổi mật khẩu chưa sẵn sàng.',
          });
          return;
        }
        const result = await authApi.changePassword(form);
        setUser(null);
        setMode('login');
        setNotice({
          type: 'success',
          text: result?.message || 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
        });
        return;
      }

      if (mode === 'login') {
        const result = await authApi.login(form);
        setUser(result.user);
        setView(
          result.user.role === 'Host'
            ? 'host'
            : result.user.role === 'Admin'
              ? 'admin'
              : 'home'
        );
        setShowHome(true);
        setNotice({
          type: 'success',
          text: result?.message || 'Đăng nhập thành công.',
        });
        return;
      }

      if (mode === 'register') {
        const result = await authApi.register(form);
        setPendingEmail(form.email);
        setMode('verify');
        setNotice({
          type: 'success',
          text: `${result?.message || 'Đăng ký thành công.'}${
            result?.developmentOtp ? ` Mã kiểm thử: ${result.developmentOtp}` : ''
          }`,
        });
        return;
      }
    } catch (error) {
      setNotice({
        type: 'error',
        text: error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.',
      });
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!pendingEmail) {
      setNotice({
        type: 'error',
        text: 'Không tìm thấy email cần xác minh.',
      });
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      const result = await authApi.resendVerification({ email: pendingEmail });
      setNotice({
        type: 'success',
        text: `${result?.message || 'Đã gửi lại mã xác minh.'}${
          result?.developmentOtp ? ` Mã kiểm thử: ${result.developmentOtp}` : ''
        }`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error?.message || 'Không thể gửi lại mã xác minh.',
      });
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try {
      const result = await authApi.logout();
      setNotice({
        type: 'success',
        text: result?.message || 'Đăng xuất thành công.',
      });
    } catch {
      setNotice({ type: 'success', text: 'Đã đăng xuất.' });
    } finally {
      setUser(null);
      setView('home');
    }
  };

  const goHome = () => {
    window.history.pushState({}, '', '/');
    setView('home');
    setShowHome(true);
    setMode('login');
    setDevelopingFeature('');
  };

  const showDeveloping = (feature) => {
    if (feature === 'forgot-password') {
      setMode('forgot');
      setNotice(null);
      return;
    }
    setDevelopingFeature(feature);
  };

  const openCatalog = () => setView('catalog');
  const openHomestay = (id, searchCriteria = null) => {
    setSelectedHomestayId(id);
    setHomestaySearch(searchCriteria);
    setView('detail');
  };

  const dialog = (
    <>
      <DevelopmentDialog
        open={Boolean(developingFeature)}
        feature={developingFeature}
        onClose={() => setDevelopingFeature('')}
      />
      {paymentResult && (
        <div
          className={`payment-result-toast ${paymentResult.success ? 'success' : 'error'}`}
          role="status"
        >
          <button onClick={() => setPaymentResult(null)}>×</button>
          <strong>
            {paymentResult.success
              ? 'Thanh toán VNPay thành công!'
              : 'Thanh toán chưa thành công'}
          </strong>
          <span>
            {paymentResult.success
              ? `Đơn ${paymentResult.code || ''} đã được xác nhận.`
              : 'Giao dịch đã bị hủy, thất bại hoặc không hợp lệ.'}
          </span>
        </div>
      )}
    </>
  );

  if (isErrorPage) {
    return (
      <ErrorPage
        code={
          [400, 401, 403, 404, 500].includes(errorCode)
            ? errorCode
            : 404
        }
        onHome={goHome}
      />
    );
  }

  /* =========================================================
     USER LOGGED IN
     ========================================================= */
  if (user && mode !== 'change-password') {
    if (user.role === 'Admin') {
      return (
        <>
          <AdminDashboardPage
            user={user}
            onLogout={logout}
            onChangePassword={() => {
              setMode('change-password');
              setShowHome(false);
              setNotice(null);
            }}
          />
          {dialog}
        </>
      );
    }

    if (user.role === 'Host' && view === 'host') {
      return (
        <>
          <HostDashboardPage
            user={user}
            onLogout={logout}
            onCustomerMode={() => setView('home')}
            onChangePassword={() => {
              setMode('change-password');
              setShowHome(false);
              setNotice(null);
            }}
            onDeveloping={showDeveloping}
          />
          {dialog}
        </>
      );
    }

    if (view === 'bookings') {
      return (
        <>
          <MyBookingsPage
            user={user}
            onHome={() => setView('home')}
            onHomestays={openCatalog}
            onAccount={() => {
              setMode('change-password');
              setShowHome(false);
              setNotice(null);
            }}
          />
          {dialog}
        </>
      );
    }

    if (view === 'catalog') {
      return (
        <>
          <CustomerHomestaysPage
            user={user}
            onBack={() => setView('home')}
            onOpen={openHomestay}
            onBookings={() => setView('bookings')}
            onAccount={() => {
              setMode('change-password');
              setShowHome(false);
              setNotice(null);
            }}
          />
          {dialog}
        </>
      );
    }

    if (view === 'detail') {
      return (
        <>
          <HomestayDetailPage
            id={selectedHomestayId}
            initialSearch={homestaySearch}
            user={user}
            onHome={() => setView('home')}
            onBack={openCatalog}
            onBookings={() => setView('bookings')}
            onAccount={() => {
              setMode('change-password');
              setShowHome(false);
              setNotice(null);
            }}
            onDeveloping={showDeveloping}
          />
          {dialog}
        </>
      );
    }

    return (
      <>
        <HomePage
          user={user}
          onLogout={logout}
          onChangePassword={() => {
            setMode('change-password');
            setShowHome(false);
            setNotice(null);
          }}
          onBrowseHomestays={openCatalog}
          onOpenHomestay={openHomestay}
          onDeveloping={showDeveloping}
        />
        {user.role === 'Host' && (
          <button
            className="return-host-portal"
            onClick={() => setView('host')}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 99,
              padding: '12px 20px',
              borderRadius: '30px',
              background: '#0b4ae6',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              boxShadow: '0 8px 24px rgba(11,74,230,0.35)',
              cursor: 'pointer',
            }}
          >
            ⌂ Về trang quản lý Host
          </button>
        )}
        {dialog}
      </>
    );
  }

  /* =========================================================
     GUEST VIEW
     ========================================================= */
  if (showHome) {
    if (view === 'catalog') {
      return (
        <>
          <CustomerHomestaysPage
            onBack={() => setView('home')}
            onOpen={openHomestay}
            onAccount={() => setShowHome(false)}
          />
          {dialog}
        </>
      );
    }

    if (view === 'detail') {
      return (
        <>
          <HomestayDetailPage
            id={selectedHomestayId}
            initialSearch={homestaySearch}
            onHome={() => setView('home')}
            onBack={openCatalog}
            onAccount={() => setShowHome(false)}
            onDeveloping={showDeveloping}
          />
          {dialog}
        </>
      );
    }

    return (
      <>
        <HomePage
          user={{ fullName: 'Khách' }}
          onLogout={() => setShowHome(false)}
          onChangePassword={() => setShowHome(false)}
          onBrowseHomestays={openCatalog}
          onOpenHomestay={openHomestay}
          onDeveloping={showDeveloping}
        />
        {dialog}
      </>
    );
  }

  /* =========================================================
     AUTH VIEW
     ========================================================= */
  return (
    <>
      <main className="auth-page">
        <section
          className="auth-shell"
          aria-label="Xác thực tài khoản Tripio"
        >
          <AuthForm
            mode={mode}
            onSubmit={submit}
            busy={busy}
            notice={notice}
            onGoHome={goHome}
            onDeveloping={showDeveloping}
            onSwitchMode={switchMode}
            onSocialLogin={socialLogin}
            onForgotPassword={forgotPassword}
            onResendVerification={resendVerification}
          />
        </section>
      </main>

      {dialog}
    </>
  );
}