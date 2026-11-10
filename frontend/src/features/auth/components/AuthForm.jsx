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
  currentPassword: '',
  newPassword: '',
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
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [registerTouched, setRegisterTouched] = useState({});
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    setForm(emptyForm);
    setError('');
    setPhoneTouched(false);
    setRegisterTouched({});
    setShowPassword(false);
  }, [mode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  const update = ({ target }) => {
    const value = target.type === 'checkbox' ? target.checked : target.value;
    setForm((current) => ({
      ...current,
      [target.name]: target.name === 'phoneNumber' && typeof value === 'string'
        ? value.replace(/[\s()-]/g, '')
        : value,
    }));
  };

  const touchRegisterField = (name) =>
    setRegisterTouched((current) => ({ ...current, [name]: true }));

  const submit = (event) => {
    event.preventDefault();
    setError('');

    if (mode === 'register' && !/^(?:0[35789]|\+84[35789])[0-9]{8}$/.test(form.phoneNumber)) {
      setPhoneTouched(true);
      return;
    }

    if (mode === 'register') {
      setRegisterTouched({ email: true, password: true, confirmPassword: true });
      if (!emailIsValid) return;
      if (!passwordIsValid) {
        setError('Mật khẩu cần 8–32 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('Mật khẩu xác nhận không khớp.');
        return;
      }
    }

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
     * Đặt lại mật khẩu / Đổi mật khẩu
     */
    if (mode === 'reset' || mode === 'change-password') {
      if (form.newPassword !== form.confirmPassword) {
        setError('Mật khẩu xác nhận không khớp.');
        return;
      }
      if (mode === 'reset') {
        return onSubmit({
          code: form.verificationCode,
          newPassword: form.newPassword,
          confirmPassword: form.confirmPassword,
        });
      }
      return onSubmit({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
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
            phoneNumber: form.phoneNumber.startsWith('+84') ? `0${form.phoneNumber.slice(3)}` : form.phoneNumber,
            password: form.password,
            confirmPassword: form.confirmPassword,
            role: 'Customer',
          }
    );
  };

  const isRegister = mode === 'register';
  const isLogin = mode === 'login';
  const isForgot = mode === 'forgot';
  const isVerify = mode === 'verify';
  const isReset = mode === 'reset';
  const isChangePassword = mode === 'change-password';
  const phoneIsValid = /^(?:0[35789]|\+84[35789])[0-9]{8}$/.test(form.phoneNumber);
  const showPhoneError = isRegister && phoneTouched && !phoneIsValid;
  // Match the registration rules on the API: one @, no whitespace, dot-atom
  // local part, valid DNS labels, and a final domain suffix of at least 2 letters.
  const emailPattern = /^(?=.{1,255}$)(?!\.)(?!.*\.\.)[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
  const emailIsValid = emailPattern.test(form.email.trim());
  const passwordIsValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,32}$/.test(form.password);
  const confirmPasswordIsValid = form.confirmPassword === form.password;
  const showEmailError = isRegister && registerTouched.email && !emailIsValid;
  const showPasswordError = isRegister && registerTouched.password && !passwordIsValid;
  const showConfirmPasswordError = isRegister && registerTouched.confirmPassword && !confirmPasswordIsValid;

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
                  : isReset
                    ? 'Đặt lại mật khẩu'
                    : isChangePassword
                      ? 'Đổi mật khẩu'
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
              Nhập email đã đăng ký để nhận mã OTP đặt lại mật khẩu.
            </p>
          )}

          {/* RESET PASSWORD */}
          {isReset && (
            <p>
              Nhập mã OTP và tạo mật khẩu mới cho tài khoản.
            </p>
          )}

          {/* CHANGE PASSWORD */}
          {isChangePassword && (
            <p>
              Nhập mật khẩu hiện tại và mật khẩu mới của bạn.
            </p>
          )}

          {/* VERIFY */}
          {isVerify && (
            <p>
              Nhập mã xác minh đã được gửi đến email của bạn.
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
                    onChange={(event) => {
                      update(event);
                      setPhoneTouched(true);
                    }}
                    onBlur={() => setPhoneTouched(true)}
                    aria-invalid={showPhoneError}
                    aria-describedby={showPhoneError ? 'phone-number-error' : undefined}
                    placeholder="Nhập số điện thoại"
                    required
                    autoComplete="tel"
                  />
                  {showPhoneError && (
                    <small id="phone-number-error" className="field-error" role="alert">
                      Nhập số di động hợp lệ, ví dụ 0988301610 hoặc +84988301610.
                    </small>
                  )}
                </label>

              </div>

              <label>
                Email

                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={update}
                  onBlur={() => touchRegisterField('email')}
                  pattern="(?=.{1,255}$)(?!\.)(?!.*\.\.)[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}"
                  maxLength="255"
                  aria-invalid={showEmailError}
                  aria-describedby={showEmailError ? 'register-email-error' : undefined}
                  placeholder="Nhập email"
                  required
                  autoComplete="email"
                />
                {showEmailError && (
                  <small id="register-email-error" className="field-error" role="alert">
                    Nhập email hợp lệ, ví dụ ten@email.com.
                  </small>
                )}
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
          {/* =========================
              RESET OTP
          ========================== */}
          {isReset && (
            <label>
              Mã OTP đặt lại mật khẩu

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
              CHANGE PASSWORD - CURRENT PASSWORD
          ========================== */}
          {isChangePassword && (
            <label>
              Mật khẩu hiện tại

              <span className="password-field">
                <input
                  name="currentPassword"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={form.currentPassword}
                  onChange={update}
                  placeholder="Nhập mật khẩu hiện tại"
                  required
                  autoComplete="current-password"
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
              NEW PASSWORD (RESET / CHANGE PASSWORD)
          ========================== */}
          {(isReset || isChangePassword) && (
            <>
              <label>
                Mật khẩu mới

                <span className="password-field">
                  <input
                    name="newPassword"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={form.newPassword}
                    onChange={update}
                    minLength="8"
                    maxLength="32"
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,32}"
                    placeholder="Nhập mật khẩu mới"
                    required
                    autoComplete="new-password"
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

              <label>
                Xác nhận mật khẩu mới

                <span className="password-field">
                  <input
                    name="confirmPassword"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={form.confirmPassword}
                    onChange={update}
                    minLength="8"
                    maxLength="32"
                    placeholder="Nhập lại mật khẩu mới"
                    required
                    autoComplete="new-password"
                  />
                </span>
              </label>
            </>
          )}

          {/* =========================
              PASSWORD (LOGIN / REGISTER)
          ========================== */}
          {(isLogin || isRegister) && (
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
                  onBlur={() => isRegister && touchRegisterField('password')}
                  minLength={isRegister ? '8' : '6'}
                  maxLength="32"
                  pattern={isRegister ? '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,32}' : '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{6,32}'}
                  aria-invalid={showPasswordError}
                  aria-describedby={showPasswordError ? 'register-password-error' : undefined}
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
                  <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                    {showPassword ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A11.6 11.6 0 0 1 12 5c5 0 9 4.5 10 7-0.4 1-1.2 2.2-2.4 3.3M6.2 6.2C3.9 7.6 2.4 9.6 2 12c1 2.5 5 7 10 7 1.1 0 2.1-.2 3.1-.6" /></> : <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
                  </svg>
                </button>
              </span>
              {showPasswordError && (
                <small id="register-password-error" className="field-error" role="alert">
                  Mật khẩu cần 8–32 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
                </small>
              )}
            </label>
          )}

          {/* =========================
              CONFIRM PASSWORD (REGISTER)
          ========================== */}
          {isRegister && (
            <label>
              Xác nhận mật khẩu

              <span className="password-field">
                <input
                  name="confirmPassword"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={form.confirmPassword}
                  onChange={update}
                  onBlur={() => touchRegisterField('confirmPassword')}
                  minLength="8"
                  maxLength="32"
                  aria-invalid={showConfirmPasswordError}
                  aria-describedby={showConfirmPasswordError ? 'register-confirm-password-error' : undefined}
                  placeholder="Nhập lại mật khẩu"
                  required
                  autoComplete="new-password"
                />
                  <button
                    type="button"
                    className="eye-button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                      {showPassword ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A11.6 11.6 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.2 2.2-2.4 3.3M6.2 6.2C3.9 7.6 2.4 9.6 2 12c1 2.5 5 7 10 7 1.1 0 2.1-.2 3.1-.6" /></> : <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
                    </svg>
                  </button>
              </span>
              {showConfirmPasswordError && (
                <small id="register-confirm-password-error" className="field-error" role="alert">
                  Mật khẩu xác nhận không khớp.
                </small>
              )}
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
              FORGOT / RESET / CHANGE PASSWORD
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

          {(isReset || isChangePassword) && (
            <button
              type="button"
              className="muted-link"
              onClick={isChangePassword ? onGoHome : () => onSwitchMode('login')}
              style={{
                alignSelf: 'flex-start',
                marginTop: '-4px',
              }}
            >
              ← {isChangePassword ? 'Quay lại' : 'Quay lại đăng nhập'}
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
                    : isReset
                      ? 'Đặt lại mật khẩu'
                      : isChangePassword
                        ? 'Cập nhật mật khẩu'
                        : 'Tạo tài khoản'}
          </button>

          {/* =========================
              RESEND OTP BUTTON (VERIFY)
          ========================== */}
          {isVerify && typeof onResendVerification === 'function' && (
            <button
              type="button"
              className="muted-link"
              disabled={busy}
              onClick={onResendVerification}
              style={{
                alignSelf: 'center',
                marginTop: '14px',
              }}
            >
              Chưa nhận được mã? Gửi lại mã OTP
            </button>
          )}

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
