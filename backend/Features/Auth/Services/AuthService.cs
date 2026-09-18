using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Auth.DTOs;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

namespace HomestayAuth.Api.Features.Auth.Services;

public class AuthService(AppDbContext db, IEmailOtpSender emailSender, IWebHostEnvironment environment) : IAuthService
{
    public async Task<(UserResponse? User, string? VerificationCode)> RegisterAsync(RegisterRequest request)
    {
        EnsureEmailDeliveryAvailable();
        var email = request.Email.Trim().ToLowerInvariant();
        var phoneNumber = NormalizePhone(request.PhoneNumber);
        var role = request.Role.Trim();
        if (!role.Equals("Customer", StringComparison.OrdinalIgnoreCase) &&
            !role.Equals("Host", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Vai trò đăng ký chỉ có thể là Customer hoặc Host.");
        role = role.Equals("Host", StringComparison.OrdinalIgnoreCase) ? "Host" : "Customer";

        var existingUser = await db.Users.SingleOrDefaultAsync(x => x.Email == email);
        if (existingUser is not null)
        {
            if (existingUser.Status != "Unverified") return (null, null);
            if (existingUser.EmailVerificationSentAt > DateTime.UtcNow.AddMinutes(-1))
                throw new ArgumentException("Mã OTP vừa được gửi. Vui lòng chờ 60 giây trước khi yêu cầu mã mới.");
            if (await db.Users.AnyAsync(x => x.Id != existingUser.Id && x.PhoneNumber == phoneNumber)) return (null, null);
            var retryCode = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            existingUser.FullName = request.FullName.Trim();
            existingUser.PhoneNumber = phoneNumber;
            existingUser.PasswordHash = HashPassword(request.Password);
            existingUser.Role = role;
            existingUser.EmailVerificationCodeHash = HashVerificationCode(retryCode);
            existingUser.EmailVerificationExpiresAt = DateTime.UtcNow.AddMinutes(10);
            existingUser.EmailVerificationSentAt = DateTime.UtcNow;
            existingUser.EmailVerificationFailedAttempts = 0;
            existingUser.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            try { await emailSender.SendAsync(existingUser.Email, existingUser.FullName, retryCode); }
            catch when (environment.IsDevelopment()) { }
            return (ToResponse(existingUser), retryCode);
        }
        if (await db.Users.AnyAsync(x => x.PhoneNumber == phoneNumber)) return (null, null);

        var verificationCode = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = email,
            PhoneNumber = phoneNumber,
            PasswordHash = HashPassword(request.Password),
            Role = role,
            Status = "Unverified",
            EmailVerificationCodeHash = HashVerificationCode(verificationCode),
            EmailVerificationExpiresAt = DateTime.UtcNow.AddMinutes(10),
            EmailVerificationSentAt = DateTime.UtcNow,
            EmailVerificationFailedAttempts = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException error) when (error.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return (null, null);
        }
        try { await emailSender.SendAsync(user.Email, user.FullName, verificationCode); }
        catch when (environment.IsDevelopment()) { /* Mã OTP được trả về để kiểm thử cục bộ. */ }
        return (ToResponse(user), verificationCode);
    }

    public async Task<(UserResponse? User, string? Token, string? Error)> LoginAsync(LoginRequest request)
    {
        var identifier = request.Identifier.Trim().ToLowerInvariant().Replace(" ", "");
        if (identifier.StartsWith("+84")) identifier = NormalizePhone(identifier);
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == identifier || x.PhoneNumber == identifier);
        if (user is null) return (null, null, "Email, số điện thoại hoặc mật khẩu không đúng.");

        if (user.LockoutEnd is not null && user.LockoutEnd > DateTime.UtcNow)
            return (null, null, "Tài khoản tạm khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau 15 phút.");

        if (string.IsNullOrWhiteSpace(user.PasswordHash) || !VerifyPassword(request.Password, user.PasswordHash))
        {
            user.FailedLoginAttempts++;
            if (user.FailedLoginAttempts >= 5)
            {
                user.LockoutEnd = DateTime.UtcNow.AddMinutes(15);
                user.FailedLoginAttempts = 0;
            }
            await db.SaveChangesAsync();
            return (null, null, "Email, số điện thoại hoặc mật khẩu không đúng.");
        }

        if (user.Status == "Unverified") return (null, null, "Tài khoản chưa xác minh email.");
        if (user.Status != "Active") return (null, null, "Tài khoản đã bị khóa.");

        user.FailedLoginAttempts = 0;
        user.LockoutEnd = null;
        await db.SaveChangesAsync();
        return (ToResponse(user), CreateToken(user, request.Remember), null);
    }

    public async Task<bool> VerifyEmailAsync(VerifyEmailRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == email);
        if (user is null || user.Status != "Unverified" || user.EmailVerificationExpiresAt <= DateTime.UtcNow)
            return false;

        var codeMatches = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(user.EmailVerificationCodeHash ?? ""),
            Encoding.UTF8.GetBytes(HashVerificationCode(request.Code)));
        if (!codeMatches)
        {
            user.EmailVerificationFailedAttempts++;
            if (user.EmailVerificationFailedAttempts >= 5)
            {
                user.EmailVerificationCodeHash = null;
                user.EmailVerificationExpiresAt = null;
            }
            await db.SaveChangesAsync();
            return false;
        }

        user.Status = "Active";
        user.EmailVerifiedAt = DateTime.UtcNow;
        user.EmailVerificationCodeHash = null;
        user.EmailVerificationExpiresAt = null;
        user.EmailVerificationSentAt = null;
        user.EmailVerificationFailedAttempts = 0;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<(string? Code, string? Error)> ResendVerificationAsync(string email)
    {
        EnsureEmailDeliveryAvailable();
        email = email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == email && x.Status == "Unverified");
        if (user is null) return (null, "Không thể gửi lại mã xác minh.");
        if (user.EmailVerificationSentAt is not null)
        {
            var secondsRemaining = 60 - (int)(DateTime.UtcNow - user.EmailVerificationSentAt.Value).TotalSeconds;
            if (secondsRemaining > 0)
                return (null, $"Vui lòng chờ {secondsRemaining} giây trước khi gửi lại mã OTP.");
        }
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        user.EmailVerificationCodeHash = HashVerificationCode(code);
        user.EmailVerificationExpiresAt = DateTime.UtcNow.AddMinutes(10);
        user.EmailVerificationSentAt = DateTime.UtcNow;
        user.EmailVerificationFailedAttempts = 0;
        await db.SaveChangesAsync();
        try { await emailSender.SendAsync(user.Email, user.FullName, code); }
        catch when (environment.IsDevelopment()) { /* Mã OTP được trả về để kiểm thử cục bộ. */ }
        return (code, null);
    }

    public async Task<string?> RequestPasswordResetAsync(string email)
    {
        EnsureEmailDeliveryAvailable();
        email = email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == email && x.Status == "Active");
        if (user is null) return null;

        if (user.PasswordResetSentAt is not null && user.PasswordResetSentAt > DateTime.UtcNow.AddMinutes(-1))
            return environment.IsDevelopment() ? "WAIT" : null;

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        user.PasswordResetCodeHash = HashVerificationCode(code);
        user.PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(10);
        user.PasswordResetSentAt = DateTime.UtcNow;
        user.PasswordResetFailedAttempts = 0;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        try { await emailSender.SendPasswordResetAsync(user.Email, user.FullName, code); }
        catch when (environment.IsDevelopment()) { }
        return code;
    }

    public async Task<(bool Success, string? Error)> ResetPasswordAsync(ResetPasswordRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == email && x.Status == "Active");
        if (user is null || user.PasswordResetExpiresAt <= DateTime.UtcNow || string.IsNullOrWhiteSpace(user.PasswordResetCodeHash))
            return (false, "Mã OTP không đúng hoặc đã hết hạn.");

        var codeMatches = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(user.PasswordResetCodeHash),
            Encoding.UTF8.GetBytes(HashVerificationCode(request.Code)));
        if (!codeMatches)
        {
            user.PasswordResetFailedAttempts++;
            if (user.PasswordResetFailedAttempts >= 5) ClearPasswordReset(user);
            await db.SaveChangesAsync();
            return (false, "Mã OTP không đúng hoặc đã hết hạn.");
        }

        if (!string.IsNullOrWhiteSpace(user.PasswordHash) && VerifyPassword(request.NewPassword, user.PasswordHash))
            return (false, "Mật khẩu mới phải khác mật khẩu hiện tại.");

        user.PasswordHash = HashPassword(request.NewPassword);
        user.AuthVersion++;
        user.FailedLoginAttempts = 0;
        user.LockoutEnd = null;
        user.UpdatedAt = DateTime.UtcNow;
        ClearPasswordReset(user);
        await db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> ChangePasswordAsync(long userId, ChangePasswordRequest request)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null || user.Status != "Active") return (false, "Tài khoản không hợp lệ.");
        if (string.IsNullOrWhiteSpace(user.PasswordHash))
            return (false, "Tài khoản mạng xã hội chưa thiết lập mật khẩu.");
        if (!VerifyPassword(request.CurrentPassword, user.PasswordHash))
            return (false, "Mật khẩu hiện tại không đúng.");
        if (VerifyPassword(request.NewPassword, user.PasswordHash))
            return (false, "Mật khẩu mới phải khác mật khẩu hiện tại.");

        user.PasswordHash = HashPassword(request.NewPassword);
        user.AuthVersion++;
        user.FailedLoginAttempts = 0;
        user.LockoutEnd = null;
        user.UpdatedAt = DateTime.UtcNow;
        ClearPasswordReset(user);
        await db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(UserResponse User, string Token)> ExternalLoginAsync(string email, string fullName)
    {
        email = email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == email);
        if (user is null)
        {
            user = new User
            {
                FullName = string.IsNullOrWhiteSpace(fullName) ? email.Split('@')[0] : fullName.Trim(),
                Email = email,
                PasswordHash = null,
                Role = "Customer",
                Status = "Active",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
        }
        if (user.Status == "Unverified")
        {
            user.Status = "Active";
            user.EmailVerifiedAt = DateTime.UtcNow;
            user.EmailVerificationCodeHash = null;
            user.EmailVerificationExpiresAt = null;
            user.EmailVerificationSentAt = null;
            user.EmailVerificationFailedAttempts = 0;
            user.FailedLoginAttempts = 0;
            user.LockoutEnd = null;
            await db.SaveChangesAsync();
        }
        if (user.Status != "Active") throw new InvalidOperationException("Tài khoản đã bị khóa.");
        return (ToResponse(user), CreateToken(user));
    }

    public async Task RevokeSessionsAsync(long userId)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null) return;
        user.AuthVersion++;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    public async Task<UserResponse?> GetUserAsync(long id)
    {
        var user = await db.Users.FindAsync(id);
        return user is null || user.Status != "Active" ? null : ToResponse(user);
    }

    private static UserResponse ToResponse(User user) => new(user.Id, user.FullName, user.Email, user.Role);

    private static string NormalizePhone(string phone)
    {
        var normalized = phone.Trim().Replace(" ", "");
        return normalized.StartsWith("+84") ? $"0{normalized[3..]}" : normalized;
    }

    private static string HashVerificationCode(string code)
    {
        var secret = Environment.GetEnvironmentVariable("OTP_HASH_SECRET")
            ?? Environment.GetEnvironmentVariable("JWT_SECRET")
            ?? throw new InvalidOperationException("Thiếu OTP_HASH_SECRET hoặc JWT_SECRET.");
        return Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(code)));
    }

    private void EnsureEmailDeliveryAvailable()
    {
        if (!emailSender.IsConfigured)
            throw new InvalidOperationException("Dịch vụ gửi email chưa được cấu hình.");
    }

    private static void ClearPasswordReset(User user)
    {
        user.PasswordResetCodeHash = null;
        user.PasswordResetExpiresAt = null;
        user.PasswordResetSentAt = null;
        user.PasswordResetFailedAttempts = 0;
    }

    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPassword(string password, string? stored)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(stored)) return false;
            var parts = stored.Split('.');
            var salt = Convert.FromBase64String(parts[0]);
            var expected = Convert.FromBase64String(parts[1]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch { return false; }
    }

    private static string CreateToken(User user, bool remember = false)
    {
        var expiresIn = remember
            ? (int.TryParse(Environment.GetEnvironmentVariable("JWT_REMEMBER_HOURS"), out var rememberHours) ? rememberHours : 720)
            : (int.TryParse(Environment.GetEnvironmentVariable("JWT_EXPIRES_HOURS"), out var hours) ? hours : 24);
        var issuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "Tripio";
        var audience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "Tripio.Web";
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("auth_version", user.AuthVersion.ToString())
        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Environment.GetEnvironmentVariable("JWT_SECRET")!));
        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(expiresIn),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
