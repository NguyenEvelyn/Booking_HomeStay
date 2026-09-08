using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Auth.DTOs;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace HomestayAuth.Api.Features.Auth.Services;

public class AuthService(AppDbContext db, IEmailOtpSender emailSender, IWebHostEnvironment environment) : IAuthService
{
    public async Task<(UserResponse? User, string? VerificationCode)> RegisterAsync(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var existingUser = await db.Users.SingleOrDefaultAsync(x => x.Email == email);
        if (existingUser is not null)
        {
            if (existingUser.Status != "Unverified") return (null, null);
            var retryCode = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            existingUser.EmailVerificationCodeHash = HashVerificationCode(retryCode);
            existingUser.EmailVerificationExpiresAt = DateTime.UtcNow.AddMinutes(10);
            await db.SaveChangesAsync();
            try { await emailSender.SendAsync(existingUser.Email, existingUser.FullName, retryCode); }
            catch when (environment.IsDevelopment()) { }
            return (ToResponse(existingUser), retryCode);
        }
        var phoneNumber = NormalizePhone(request.PhoneNumber);
        if (await db.Users.AnyAsync(x => x.PhoneNumber == phoneNumber)) return (null, null);
        var role = request.Role.Trim();
        if (!role.Equals("Customer", StringComparison.OrdinalIgnoreCase) &&
            !role.Equals("Host", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Vai trò đăng ký chỉ có thể là Customer hoặc Host.");
        role = role.Equals("Host", StringComparison.OrdinalIgnoreCase) ? "Host" : "Customer";

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
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        try { await emailSender.SendAsync(user.Email, user.FullName, verificationCode); }
        catch when (environment.IsDevelopment()) { /* Mã OTP được trả về để kiểm thử cục bộ. */ }
        return (ToResponse(user), verificationCode);
    }

    public async Task<(UserResponse? User, string? Token, string? Error)> LoginAsync(LoginRequest request)
    {
        var identifier = request.Identifier.Trim().ToLowerInvariant().Replace(" ", "");
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
        return (ToResponse(user), CreateToken(user), null);
    }

    public async Task<bool> VerifyEmailAsync(VerifyEmailRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == email);
        if (user is null || user.Status != "Unverified" || user.EmailVerificationExpiresAt <= DateTime.UtcNow
            || !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(user.EmailVerificationCodeHash ?? ""),
                Encoding.UTF8.GetBytes(HashVerificationCode(request.Code)))) return false;

        user.Status = "Active";
        user.EmailVerifiedAt = DateTime.UtcNow;
        user.EmailVerificationCodeHash = null;
        user.EmailVerificationExpiresAt = null;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<string?> ResendVerificationAsync(string email)
    {
        email = email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == email && x.Status == "Unverified");
        if (user is null) return null;
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        user.EmailVerificationCodeHash = HashVerificationCode(code);
        user.EmailVerificationExpiresAt = DateTime.UtcNow.AddMinutes(10);
        await db.SaveChangesAsync();
        try { await emailSender.SendAsync(user.Email, user.FullName, code); }
        catch when (environment.IsDevelopment()) { /* Mã OTP được trả về để kiểm thử cục bộ. */ }
        return code;
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
        if (user.Status != "Active") throw new InvalidOperationException("Tài khoản đã bị khóa.");
        return (ToResponse(user), CreateToken(user));
    }

    public async Task<UserResponse?> GetUserAsync(long id)
    {
        var user = await db.Users.FindAsync(id);
        return user is null ? null : ToResponse(user);
    }

    private static UserResponse ToResponse(User user) => new(user.Id, user.FullName, user.Email, user.Role);

    private static string NormalizePhone(string phone)
    {
        var normalized = phone.Trim().Replace(" ", "");
        return normalized.StartsWith("+84") ? $"0{normalized[3..]}" : normalized;
    }

    private static string HashVerificationCode(string code) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));

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

    private static string CreateToken(User user)
    {
        var expiresIn = int.TryParse(Environment.GetEnvironmentVariable("JWT_EXPIRES_HOURS"), out var hours) ? hours : 24;
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role)
        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Environment.GetEnvironmentVariable("JWT_SECRET")!));
        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddHours(expiresIn),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
