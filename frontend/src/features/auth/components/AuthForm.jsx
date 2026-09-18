import React, { useEffect, useState } from 'react';
import '../styles/auth.css';

const emptyForm = {
  fullName: '',
  identifier: '',
  email: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
  verificationCode: '',
  remember: false,
};

const slides = [
  {
    image: '/assets/figma/auth-visual-1.jpg',
    title: (
      <>
        Nơi Mọi Hành Trình
        <br />
        Đáng Nhớ Bắt Đầu
      </>
    ),
  },
  {
    image: '/assets/figma/auth-visual-2.jpg',
    title: (
      <>
        Nơi Mọi Hành Trình
        <br />
        Đáng Nhớ Bắt Đầu
      </>
    ),
  },
  {
    image: '/assets/figma/auth-visual-3.jpg',
    title: (
      <>
        Nơi Mọi Hành Trình
        <br />
        Đáng Nhớ Bắt Đầu
      </>
    ),
  },
  {
    image: '/assets/figma/auth-visual-4.jpg',
    title: (
      <>
        Nơi Mọi Hành Trình
        <br />
        Đáng Nhớ Bắt Đầu
      </>
    ),
  },
];

export default function AuthForm({
  mode,
  onSubmit,
  busy,
  notice,
  onDeveloping,
  onSwitchMode,
  onSocialLogin,
  onForgotPassword,
  onGoHome,
  onResendVerification,
}) {
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    setForm(emptyForm);
    setError('');
    setShowPassword(false);
  }, [mode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  const update = ({ target }) => {
    setForm((current) => ({
      ...current,
      [target.name]:
        target.type === 'checkbox'
          ? target.checked
          : target.value,
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    setError('');

    /*
     * Xác minh OTP
     */
    if (mode === 'verify') {
      return onSubmit({
        code: form.verificationCode,
      });
    }

    /*
     * Quên mật khẩu
     */
    if (mode === 'forgot') {
      return onSubmit({
        email: form.email,
      });
    }

    /*
     * Đăng nhập / Đăng ký
     */
    onSubmit(
      mode === 'login'
        ? {
            identifier: form.identifier,
            password: form.password,
            remember: form.remember,
          }
        : {
            fullName: form.fullName,
            email: form.email,
            phoneNumber: form.phoneNumber,
            password: form.password,
            role: 'Customer',
          }
    );
  };

  const isRegister = mode === 'register';
  const isLogin = mode === 'login';
  const isForgot = mode === 'forgot';
  const isVerify = mode === 'verify';

  return (
    <>
      {/* =========================
          LEFT VISUAL
      ========================== */}
      <div className="auth-visual">
        {slides.map((slide, index) => (
          <img
            key={slide.image}
            src={slide.image}
            alt=""
            className={`auth-slide ${
              activeSlide === index ? 'is-active' : ''
            }`}
          />
        ))}

        <div className="auth-visual-overlay" />

        <button
          type="button"
          className="auth-home-link"
          onClick={onGoHome}
        >
          Về trang chủ
          <span>→</span>
        </button>

        <img
          src="/assets/figma/tripio-logo-white.png"
          alt="Tripio"
          className="auth-logo"
        />

        <div className="auth-visual-bottom">
          <div className="auth-visual-title">
            {slides[activeSlide].title}
          </div>

          <div className="auth-slides">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Slide ${index + 1}`}
                className={
                  activeSlide === index
                    ? 'is-active'
                    : ''
                }
                onClick={() => setActiveSlide(index)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* =========================
          RIGHT CONTENT
      ========================== */}
      <div className="auth-content">

        {/* =========================
            HEADER
        ========================== */}
        <div className="form-header">

          <h1>
            {isRegister
              ? 'Tạo tài khoản'
              : isLogin
                ? 'Đăng nhập vào tài khoản'
                : isForgot
                  ? 'Quên mật khẩu'
                  : 'Xác minh tài khoản'}
          </h1>

          {/* REGISTER */}
          {isRegister && (
            <p>
              Đã có tài khoản?{' '}
              <button
                type="button"
                className="text-button"
                onClick={onSwitchMode}
              >
                Đăng nhập
              </button>
            </p>
          )}

          {/* LOGIN */}
          {isLogin && (
            <p>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                className="text-button"
                onClick={onSwitchMode}
              >
                Đăng ký
              </button>
            </p>
          )}

          {/* FORGOT PASSWORD */}
          {isForgot && (
            <p>
              Nhập email đã đăng ký để nhận hướng dẫn
              đặt lại mật khẩu.
            </p>
          )}

          {/* VERIFY */}
          {isVerify && (
            <p>
              Nhập mã xác minh đã được gửi đến email
              của bạn.
            </p>
          )}

        </div>

        {/* =========================
            FORM
        ========================== */}
        <form
          onSubmit={submit}
          className="form"
        >

          {/* =========================
              VERIFY OTP
          ========================== */}
          {isVerify && (
            <label>
              Mã OTP xác minh email

              <input
                name="verificationCode"
                inputMode="numeric"
                value={form.verificationCode}
                onChange={update}
                pattern="[0-9]{6}"
                minLength="6"
                maxLength="6"
                placeholder="Nhập mã OTP gồm 6 chữ số"
                required
                autoComplete="one-time-code"
              />
            </label>
          )}

          {/* =========================
              REGISTER
          ========================== */}
          {isRegister && (
            <>
              <div className="field-row">

                <label>
                  Họ và Tên

                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={update}
                    minLength="2"
                    maxLength="100"
                    placeholder="Nhập họ và tên"
                    required
                    autoComplete="name"
                  />
                </label>

                <label>
                  Số điện thoại

                  <input
                    name="phoneNumber"
                    type="tel"
                    value={form.phoneNumber}
                    onChange={update}
                    pattern="(0|\+84)(3|5|7|8|9)[0-9]{8}"
                    placeholder="Nhập số điện thoại"
                    required
                    autoComplete="tel"
                  />
                </label>

              </div>

              <label>
                Email

                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={update}
                  placeholder="Nhập email"
                  required
                  autoComplete="email"
                />
              </label>
            </>
          )}

          {/* =========================
              FORGOT PASSWORD
          ========================== */}
          {isForgot && (
            <label>
              Email

              <input
                name="email"
                type="email"
                value={form.email}
                onChange={update}
                placeholder="Nhập email đã đăng ký"
                required
                autoComplete="email"
              />
            </label>
          )}

          {/* =========================
              LOGIN
          ========================== */}
          {isLogin && (
            <label>
              Email hoặc Số điện thoại

              <input
                name="identifier"
                value={form.identifier}
                onChange={update}
                placeholder="Nhập email hoặc Số điện thoại"
                required
                autoComplete="username"
              />
            </label>
          )}

          {/* =========================
              PASSWORD
          ========================== */}
          {!isVerify && !isForgot && (
            <label>
              Mật khẩu

              <span className="password-field">

                <input
                  name="password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={form.password}
                  onChange={update}
                  minLength="6"
                  maxLength="32"
                  pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{6,32}"
                  placeholder="Nhập mật khẩu"
                  required
                  autoComplete={
                    isLogin
                      ? 'current-password'
                      : 'new-password'
                  }
                />

                <button
                  type="button"
                  className="eye-button"
                  onClick={() =>
                    setShowPassword(
                      (value) => !value
                    )
                  }
                  aria-label={
                    showPassword
                      ? 'Ẩn mật khẩu'
                      : 'Hiện mật khẩu'
                  }
                >
                  {showPassword ? '◉' : '◌'}
                </button>

              </span>
            </label>
          )}

          {/* =========================
              LOGIN OPTIONS
          ========================== */}
          {isLogin && (
            <div className="form-options">

              <label className="check-label">
                <input
                  name="remember"
                  type="checkbox"
                  checked={form.remember}
                  onChange={update}
                />

                <span>
                  Nhớ mật khẩu
                </span>
              </label>

              <button
                type="button"
                className="muted-link"
                onClick={() => {
                  if (typeof onForgotPassword === 'function') {
                    onForgotPassword();
                  }
                }}
              >
                Quên mật khẩu?
              </button>

            </div>
          )}

          {/* =========================
              BACK TO LOGIN
              FORGOT
          ========================== */}
          {isForgot && (
            <button
              type="button"
              className="muted-link"
              onClick={onSwitchMode}
              style={{
                alignSelf: 'flex-start',
                marginTop: '-4px',
              }}
            >
              ← Quay lại đăng nhập
            </button>
          )}

          {/* =========================
              ERROR / NOTICE
          ========================== */}
          {(error || notice?.text) && (
            <p
              className={`inline-error ${notice?.type === 'success' ? 'is-success' : ''}`}
              role="alert"
            >
              {error || notice.text}
            </p>
          )}

          {/* =========================
              SUBMIT
          ========================== */}
          <button
            type="submit"
            className="primary-button"
            disabled={busy}
          >
            {busy
              ? 'Đang xử lý...'
              : isLogin
                ? 'Đăng nhập'
                : isForgot
                  ? 'Gửi yêu cầu đặt lại mật khẩu'
                  : isVerify
                    ? 'Xác minh tài khoản'
                    : 'Tạo tài khoản'}
          </button>

        </form>

        {/* =========================
            SOCIAL LOGIN
        ========================== */}
        {(isRegister || isLogin) && (
          <>
            <div className="divider">
              <span>Hoặc</span>
            </div>

            <div className="social-row">

              {/* FACEBOOK */}
              <button
                type="button"
                className="social-button"
                onClick={() =>
                  onSocialLogin('facebook')
                }
                disabled={busy}
              >
                <span className="facebook">
                  f
                </span>

                Facebook
              </button>

              {/* GOOGLE */}
              <button
                type="button"
                className="social-button"
                onClick={() =>
                  onSocialLogin('google')
                }
                disabled={busy}
              >
                <span className="google">
                  G
                </span>

                Google
              </button>

            </div>
          </>
        )}

      </div>
    </>
  );
}