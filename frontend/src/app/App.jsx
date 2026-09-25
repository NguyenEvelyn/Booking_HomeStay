import React, { useEffect, useState } from 'react';

import AuthForm from '../features/auth/components/AuthForm.jsx';
import { authApi } from '../features/auth/api/authApi.js';

import HomePage from '../features/home/HomePage.jsx';
import CustomerHomestaysPage from '../features/homestays/pages/CustomerHomestaysPage.jsx';
import HomestayDetailPage from '../features/homestays/pages/HomestayDetailPage.jsx';
import HostDashboardPage from '../features/homestays/pages/HostDashboardPage.jsx';
import MyBookingsPage from '../features/bookings/pages/MyBookingsPage.jsx';
import AdminDashboardPage from '../features/admin/pages/AdminDashboardPage.jsx';

import DevelopmentDialog from '../shared/components/DevelopmentDialog.jsx';
import ErrorPage from '../shared/components/ErrorPage.jsx';

export default function App() {
  const [user, setUser] = useState(null);

  /*
   * Các mode xác thực:
   * login           = đăng nhập
   * register        = đăng ký
   * verify          = xác minh OTP đăng ký
   * forgot          = gửi OTP quên mật khẩu
   * reset           = đặt lại mật khẩu với OTP
   * change-password = đổi mật khẩu khi đã đăng nhập
   */
  const [mode, setMode] = useState('login');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [developingFeature, setDevelopingFeature] = useState('');
  const [showHome, setShowHome] = useState(true);
  const [pendingEmail, setPendingEmail] = useState('');

  /*
   * Điều hướng trang nội bộ:
   * 'home'     = Trang chủ Figma
   * 'catalog'  = Danh sách khám phá homestay
   * 'detail'   = Chi tiết homestay & đặt phòng
   * 'bookings' = Đơn đặt phòng của tôi
   * 'host'     = Bảng điều khiển Host
   * 'admin'    = Bảng quản trị Admin
   */
  const [view, setView] = useState('home');
  const [selectedHomestayId, setSelectedHomestayId] = useState(null);
  const [homestaySearch, setHomestaySearch] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const [catalogVersion, setCatalogVersion] = useState(0);

  /* =========================================================
     ERROR PAGE CHECK
     ========================================================= */
  const errorCode = Number(window.location.pathname.slice(1));
  const isErrorPage =
    [400, 401, 403, 404, 500].includes(errorCode) ||
    !['/', ''].includes(window.location.pathname);

  /* =========================================================
     CHECK USER & PAYMENT RESULT
     ========================================================= */
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

  useEffect(() => {
    const refreshCatalog = (event) => {
      if (!event || event.key === 'tripio-catalog-version') {
        setCatalogVersion((current) => current + 1);
      }
    };
    window.addEventListener('storage', refreshCatalog);
    window.addEventListener('focus', refreshCatalog);
    return () => {
      window.removeEventListener('storage', refreshCatalog);
      window.removeEventListener('focus', refreshCatalog);
    };
  }, []);

  const markCatalogChanged = () => {
    localStorage.setItem('tripio-catalog-version', String(Date.now()));
    setCatalogVersion((current) => current + 1);
  };

  /* =========================================================
     SWITCH LOGIN / REGISTER
     ========================================================= */
  const switchMode = () => {
    setMode((current) => (current === 'login' ? 'register' : 'login'));
    setNotice(null);
    setDevelopingFeature('');
  };

  /* =========================================================
     GO TO FORGOT PASSWORD
     ========================================================= */
  const forgotPassword = () => {
    setMode('forgot');
    setNotice(null);
    setDevelopingFeature('');
    setPendingEmail('');
  };

  /* =========================================================
     SOCIAL LOGIN
     ========================================================= */
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
      }
    } catch (error) {
      setBusy(false);
      setNotice({
        type: 'error',
        text: error?.message || 'Đăng nhập mạng xã hội không thành công.',
      });
    }
  };

  /* =========================================================
     SUBMIT AUTH FORM
     ========================================================= */
  const submit = async (form) => {
    setBusy(true);
    setNotice(null);

    try {
      if (mode === 'verify') {
        const result = await authApi.verifyEmail({
          email: pendingEmail,
          code: form.code,
        });
        setMode('login');
        setNotice({
          type: 'success',
          text: result?.message || 'Xác minh tài khoản thành công. Vui lòng đăng nhập.',
        });
        return;
      }

      if (mode === 'forgot') {
        const result = await authApi.forgotPassword({
          email: form.email,
        });
        setPendingEmail(form.email);
        setMode('reset');
        setNotice({
          type: 'success',
          text: result?.message || 'Mã OTP đặt lại mật khẩu đã được gửi đến email.',
        });
        return;
      }

      if (mode === 'reset') {
        const result = await authApi.resetPassword({
          ...form,
          email: pendingEmail,
        });
        setMode('login');
        setNotice({
          type: 'success',
          text: result?.message || 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
        });
        return;
      }

      if (mode === 'change-password') {
        const result = await authApi.changePassword(form);
        setUser(null);
        setMode('login');
        setShowHome(false);
        setNotice({
          type: 'success',
          text: result?.message || 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
        });
        return;
      }

      if (mode === 'login') {
        const result = await authApi.login(form);
        setUser(result.user);
        setView(result.user.role === 'Host' ? 'host' : ['Admin', 'Support'].includes(result.user.role) ? 'admin'
          : ['catalog', 'detail'].includes(view) ? view : 'home');
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

  /* =========================================================
     RESEND OTP
     ========================================================= */
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
      const result = await authApi.resendVerification({
        email: pendingEmail,
      });
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

  /* =========================================================
     LOGOUT
     ========================================================= */
  const logout = async () => {
    try {
      const result = await authApi.logout();
      setNotice({
        type: 'success',
        text: result?.message || 'Đăng xuất thành công.',
      });
    } catch {
      setNotice({
        type: 'success',
        text: 'Đã đăng xuất.',
      });
    } finally {
      setUser(null);
      setView('home');
    }
  };

  /* =========================================================
     NAVIGATION HELPERS
     ========================================================= */
  const goHome = () => {
    window.history.pushState({}, '', '/');
    setView('home');
    setShowHome(true);
    setMode('login');
    setDevelopingFeature('');
  };

  const openCatalog = (searchCriteria = null) => {
    setHomestaySearch(searchCriteria);
    setView('catalog');
  };

  const openHomestay = (id, searchCriteria = null) => {
    setSelectedHomestayId(id);
    setHomestaySearch(searchCriteria);
    setView('detail');
  };

  const showDeveloping = (feature) => {
    setDevelopingFeature(feature);
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
          className={`payment-result-toast ${
            paymentResult.success ? 'success' : 'error'
          }`}
          role="status"
        >
          <button onClick={() => setPaymentResult(null)}>×</button>
          <strong>
            {paymentResult.success ? 'Thanh toán VNPay thành công!'
              : paymentResult.status === 'refund-pending' ? 'Đã nhận tiền, đơn không còn giữ phòng'
              : 'Thanh toán chưa thành công'}
          </strong>
          <span>
            {paymentResult.success ? `Đơn đặt phòng ${paymentResult.code || ''} đã được xác nhận.`
              : paymentResult.status === 'refund-pending'
                ? `Đơn ${paymentResult.code || ''} đã hết thời gian giữ phòng. Khoản tiền đang chờ xử lý hoàn lại; vui lòng liên hệ hỗ trợ.`
                : 'Giao dịch đã bị hủy, thất bại hoặc không hợp lệ.'}
          </span>
        </div>
      )}
    </>
  );

  /* =========================================================
     ERROR PAGE
     ========================================================= */
  if (isErrorPage) {
    return (
      <ErrorPage
        code={[400, 401, 403, 404, 500].includes(errorCode) ? errorCode : 404}
        onHome={goHome}
      />
    );
  }

  /* =========================================================
     CHANGE PASSWORD MODE (DÀNH CHO USER ĐANG ĐĂNG NHẬP)
     ========================================================= */
  if (mode === 'change-password') {
    return (
      <>
        <main className="auth-page">
          <section
            className="auth-shell"
            aria-label="Đổi mật khẩu tài khoản Tripio"
          >
            <AuthForm
              mode="change-password"
              onSubmit={submit}
              busy={busy}
              notice={notice}
              onGoHome={goHome}
              onDeveloping={showDeveloping}
              onSwitchMode={switchMode}
            />
          </section>
        </main>
        {dialog}
      </>
    );
  }

  /* =========================================================
     USER ĐÃ ĐĂNG NHẬP
     ========================================================= */
  if (user) {
    if (['Admin', 'Support'].includes(user.role) && view === 'admin') {
      return (
        <>
          <AdminDashboardPage
            user={user}
            onLogout={logout}
            onChangePassword={() => {
              setMode('change-password');
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
            onCatalogChanged={markCatalogChanged}
            onChangePassword={() => {
              setMode('change-password');
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
            onHomestays={() => setView('catalog')}
            onAccount={() => {
              setMode('change-password');
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
            refreshKey={catalogVersion}
            initialSearch={homestaySearch}
            user={user}
            onBack={() => setView('home')}
            onOpen={openHomestay}
            onBookings={() => setView('bookings')}
            onAccount={() => {
              setMode('change-password');
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
            refreshKey={catalogVersion}
            id={selectedHomestayId}
            initialSearch={homestaySearch}
            user={user}
            onHome={() => setView('home')}
            onBack={() => setView('catalog')}
            onBookings={() => setView('bookings')}
            onAccount={() => {
              setMode('change-password');
              setNotice(null);
            }}
            onDeveloping={showDeveloping}
          />
          {dialog}
        </>
      );
    }

    /* Mặc định cho User đã đăng nhập: Trang chủ Figma */
    return (
      <>
        <HomePage
          refreshKey={catalogVersion}
          user={user}
          onLogout={logout}
          onChangePassword={() => {
            setMode('change-password');
            setNotice(null);
          }}
          onBrowseHomestays={openCatalog}
          onOpenHomestay={openHomestay}
          onBookings={() => setView('bookings')}
          onHostPortal={() => setView('host')}
          onAdminPortal={() => setView('admin')}
          onDeveloping={showDeveloping}
        />

        {user.role === 'Host' && (
          <button
            className="return-host-portal"
            onClick={() => setView('host')}
          >
            ⌂ Về trang quản lý Host
          </button>
        )}

        {dialog}
      </>
    );
  }

  /* =========================================================
     KHÁCH CHƯA ĐĂNG NHẬP
     ========================================================= */
  if (showHome) {
    if (view === 'catalog') {
      return (
        <>
          <CustomerHomestaysPage
            refreshKey={catalogVersion}
            initialSearch={homestaySearch}
            user={null}
            onBack={() => setView('home')}
            onOpen={openHomestay}
            onAccount={() => {
              setShowHome(false);
              setMode('login');
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
            refreshKey={catalogVersion}
            id={selectedHomestayId}
            initialSearch={homestaySearch}
            user={null}
            onHome={() => setView('home')}
            onBack={() => setView('catalog')}
            onAccount={() => {
              setShowHome(false);
              setMode('login');
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
          refreshKey={catalogVersion}
          user={{ fullName: 'Khách' }}
          onLogout={() => {
            setShowHome(false);
            setMode('login');
          }}
          onBrowseHomestays={openCatalog}
          onOpenHomestay={openHomestay}
          onDeveloping={showDeveloping}
        />
        {dialog}
      </>
    );
  }

  /* =========================================================
     MÀN HÌNH ĐĂNG NHẬP / ĐĂNG KÝ FIGMA
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
