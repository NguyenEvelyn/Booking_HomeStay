import React, { useEffect, useState } from 'react';

import AuthForm from '../features/auth/components/AuthForm.jsx';
import { authApi } from '../features/auth/api/authApi.js';

import HomePage from '../features/home/HomePage.jsx';
import DevelopmentDialog from '../shared/components/DevelopmentDialog.jsx';
import ErrorPage from '../shared/components/ErrorPage.jsx';


export default function App() {
  const [user, setUser] = useState(null);

  /*
   * Các mode:
   * login    = đăng nhập
   * register = đăng ký
   * verify   = xác minh OTP đăng ký
   * forgot   = quên mật khẩu
   */
  const [mode, setMode] = useState('login');

  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const [developingFeature, setDevelopingFeature] =
    useState('');

  const [showHome, setShowHome] = useState(true);

  /*
   * Email đang chờ xác minh OTP
   */
  const [pendingEmail, setPendingEmail] = useState('');


  /* =========================================================
     ERROR PAGE
     ========================================================= */

  const errorCode = Number(
    window.location.pathname.slice(1)
  );

  const isErrorPage =
    [400, 401, 403, 404, 500].includes(errorCode) ||
    !['/', ''].includes(window.location.pathname);


  /* =========================================================
     KIỂM TRA USER HIỆN TẠI
     ========================================================= */

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    authApi
      .me()
      .then(({ user: currentUser }) => {
        setUser(currentUser);

        /*
         * Xóa query ?auth=... sau khi xử lý callback
         */
        if (params.has('auth')) {
          window.history.replaceState(
            {},
            '',
            window.location.pathname
          );
        }
      })
      .catch(() => {
        if (params.get('auth') === 'error') {
          setNotice({
            type: 'error',
            text:
              'Đăng nhập mạng xã hội không thành công.',
          });
        }
      });
  }, []);


  /* =========================================================
     CHUYỂN LOGIN / REGISTER
     ========================================================= */

  const switchMode = () => {
    setMode((current) => {
      /*
       * Nếu đang login -> register
       * Nếu đang register -> login
       *
       * Nếu đang forgot hoặc verify -> login
       */
      if (current === 'login') {
        return 'register';
      }

      return 'login';
    });

    setNotice(null);
    setDevelopingFeature('');
  };


  /* =========================================================
     ĐI TỚI TRANG QUÊN MẬT KHẨU
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
    /*
     * authApi.externalLogin() hiện tại của bạn
     * tự redirect sang Google / Facebook.
     */

    if (
      typeof authApi.externalLogin !== 'function'
    ) {
      setNotice({
        type: 'error',
        text:
          'Chức năng đăng nhập mạng xã hội chưa được cấu hình trong authApi.',
      });

      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      const result =
        authApi.externalLogin(provider);

      /*
       * Hỗ trợ cả trường hợp API trả URL.
       */
      if (typeof result === 'string') {
        window.location.href = result;
        return;
      }

      /*
       * authApi hiện tại tự redirect nên
       * thường sẽ không chạy tới đây.
       */
    } catch (error) {
      setBusy(false);

      setNotice({
        type: 'error',
        text:
          error?.message ||
          'Đăng nhập mạng xã hội không thành công.',
      });
    }
  };


  /* =========================================================
     SUBMIT AUTH
     ========================================================= */

  const submit = async (form) => {
    setBusy(true);
    setNotice(null);

    try {

      /* -------------------------------------------------------
         XÁC MINH OTP ĐĂNG KÝ
         ------------------------------------------------------- */

      if (mode === 'verify') {
        const result =
          await authApi.verifyEmail({
            email: pendingEmail,
            code: form.code,
          });

        /*
         * Xác minh thành công -> quay lại login
         */
        setMode('login');

        setNotice({
          type: 'success',
          text:
            result?.message ||
            'Xác minh tài khoản thành công. Vui lòng đăng nhập.',
        });

        return;
      }


      /* -------------------------------------------------------
         QUÊN MẬT KHẨU
         ------------------------------------------------------- */

      if (mode === 'forgot') {

        /*
         * Kiểm tra authApi đã có API forgot password chưa.
         *
         * Hiện tại authApi.js bạn gửi CHƯA có hàm này.
         * Vì vậy không gọi một hàm không tồn tại.
         */
        if (
          typeof authApi.forgotPassword !== 'function'
        ) {
          setNotice({
            type: 'error',
            text:
              'Giao diện Quên mật khẩu đã sẵn sàng, nhưng authApi.js chưa có API xử lý quên mật khẩu.',
          });

          return;
        }

        const result =
          await authApi.forgotPassword({
            email: form.email,
          });

        setNotice({
          type: 'success',
          text:
            result?.message ||
            'Yêu cầu đặt lại mật khẩu đã được gửi.',
        });

        return;
      }


      /* -------------------------------------------------------
         ĐĂNG NHẬP
         ------------------------------------------------------- */

      if (mode === 'login') {
        const result =
          await authApi.login(form);

        setUser(result.user);

        setNotice({
          type: 'success',
          text:
            result?.message ||
            'Đăng nhập thành công.',
        });

        return;
      }


      /* -------------------------------------------------------
         ĐĂNG KÝ
         ------------------------------------------------------- */

      if (mode === 'register') {
        const result =
          await authApi.register(form);

        /*
         * Lưu email để dùng cho bước OTP
         */
        setPendingEmail(form.email);

        /*
         * Chuyển sang màn hình xác minh
         */
        setMode('verify');

        setNotice({
          type: 'success',
          text: `${result?.message || 'Đăng ký thành công.'}${
            result?.developmentOtp
              ? ` Mã kiểm thử: ${result.developmentOtp}`
              : ''
          }`,
        });

        return;
      }

    } catch (error) {
      setNotice({
        type: 'error',
        text:
          error?.message ||
          'Có lỗi xảy ra. Vui lòng thử lại.',
      });

    } finally {
      setBusy(false);
    }
  };


  /* =========================================================
     GỬI LẠI OTP
     ========================================================= */

  const resendVerification = async () => {
    if (!pendingEmail) {
      setNotice({
        type: 'error',
        text:
          'Không tìm thấy email cần xác minh.',
      });

      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      const result =
        await authApi.resendVerification({
          email: pendingEmail,
        });

      setNotice({
        type: 'success',
        text: `${result?.message || 'Đã gửi lại mã xác minh.'}${
          result?.developmentOtp
            ? ` Mã kiểm thử: ${result.developmentOtp}`
            : ''
        }`,
      });

    } catch (error) {
      setNotice({
        type: 'error',
        text:
          error?.message ||
          'Không thể gửi lại mã xác minh.',
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
      const result =
        await authApi.logout();

      setUser(null);

      setNotice({
        type: 'success',
        text:
          result?.message ||
          'Đăng xuất thành công.',
      });

    } catch (error) {
      setNotice({
        type: 'error',
        text:
          error?.message ||
          'Đăng xuất không thành công.',
      });
    }
  };


  /* =========================================================
     VỀ TRANG CHỦ
     ========================================================= */

  const goHome = () => {
    window.history.pushState(
      {},
      '',
      '/'
    );

    setShowHome(true);
    setDevelopingFeature('');
  };


  /* =========================================================
     DEVELOPMENT DIALOG
     ========================================================= */

  const showDeveloping = (feature) => {
    setDevelopingFeature(feature);
  };


  const dialog = (
    <DevelopmentDialog
      open={Boolean(developingFeature)}
      feature={developingFeature}
      onClose={() =>
        setDevelopingFeature('')
      }
    />
  );


  /* =========================================================
     ERROR PAGE
     ========================================================= */

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
     ĐÃ ĐĂNG NHẬP
     ========================================================= */

  if (user) {
    return (
      <>
        <HomePage
          user={user}
          onLogout={logout}
          onDeveloping={showDeveloping}
        />

        {dialog}
      </>
    );
  }


  /* =========================================================
     XEM TRANG CHỦ VỚI TƯ CÁCH KHÁCH
     ========================================================= */

  if (showHome) {
    return (
      <>
        <HomePage
          user={{
            fullName: 'Khách',
          }}
          onLogout={() =>
            setShowHome(false)
          }
          onDeveloping={showDeveloping}
        />

        {dialog}
      </>
    );
  }


  /* =========================================================
     AUTH PAGE
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

            /*
             * Giữ lại để các chức năng khác
             * như Facebook / Google hoặc Home
             * có thể dùng DevelopmentDialog.
             */
            onDeveloping={showDeveloping}

            /*
             * Login <-> Register
             */
            onSwitchMode={switchMode}

            /*
             * Google / Facebook
             */
            onSocialLogin={socialLogin}

            /*
             * Login -> Forgot Password
             */
            onForgotPassword={forgotPassword}

            /*
             * Verify -> gửi lại OTP
             */
            onResendVerification={
              resendVerification
            }
          />

        </section>
      </main>

      {dialog}
    </>
  );
}