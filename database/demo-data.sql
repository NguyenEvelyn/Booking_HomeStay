-- Dữ liệu chỉ dùng để demo/kiểm thử. Không chạy trên cơ sở dữ liệu production thật.
-- Mật khẩu chung của ba tài khoản: Demo@123

BEGIN;

INSERT INTO users (
  full_name,
  email,
  phone_number,
  password_hash,
  role,
  status,
  email_verified_at,
  email_verification_code_hash,
  email_verification_expires_at,
  email_verification_sent_at,
  email_verification_failed_attempts,
  password_reset_code_hash,
  password_reset_expires_at,
  password_reset_sent_at,
  password_reset_failed_attempts,
  failed_login_attempts,
  lockout_end,
  auth_version,
  created_at,
  updated_at
)
VALUES
  (
    'Nguyễn Minh Khách',
    'customer@tripio.demo',
    '0900000001',
    '6C8rmCqTYrIt6QvTr4vvhg==.PRhPb8zalnNVFXTHxBTjdee7CUaf5eEMzeexwAZ6wcs=',
    'Customer', 'Active', CURRENT_TIMESTAMP,
    NULL, NULL, NULL, 0, NULL, NULL, NULL, 0, 0, NULL, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'Trần Hoàng Chủ Nhà',
    'host@tripio.demo',
    '0900000002',
    'VpCx1bLpNi4lpeWoC6HhOA==.cQaJxLl1O1J9UNqM+JVeJCmwhpL0/dqZ51iQONmavsQ=',
    'Host', 'Active', CURRENT_TIMESTAMP,
    NULL, NULL, NULL, 0, NULL, NULL, NULL, 0, 0, NULL, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'Lê Quản Trị',
    'admin@tripio.demo',
    '0900000003',
    'QSASxcTaU18bdACHD5+UgA==.104IDXkQ4/a6wugihT2JzJli5TTtjlcwj32az5CdpT0=',
    'Admin', 'Active', CURRENT_TIMESTAMP,
    NULL, NULL, NULL, 0, NULL, NULL, NULL, 0, 0, NULL, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone_number = EXCLUDED.phone_number,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  status = 'Active',
  email_verified_at = CURRENT_TIMESTAMP,
  email_verification_code_hash = NULL,
  email_verification_expires_at = NULL,
  email_verification_sent_at = NULL,
  email_verification_failed_attempts = 0,
  password_reset_code_hash = NULL,
  password_reset_expires_at = NULL,
  password_reset_sent_at = NULL,
  password_reset_failed_attempts = 0,
  failed_login_attempts = 0,
  lockout_end = NULL,
  auth_version = users.auth_version + 1,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

SELECT user_id, full_name, email, phone_number, role, status
FROM users
WHERE email IN ('customer@tripio.demo', 'host@tripio.demo', 'admin@tripio.demo')
ORDER BY user_id;
