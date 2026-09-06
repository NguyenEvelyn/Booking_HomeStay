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

public class AuthService(AppDbContext db) : IAuthService
{
    public async Task<UserResponse?> RegisterAsync(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Email == email)) return null;
        var phoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim().Replace(" ", "");
        if (phoneNumber is not null && await db.Users.AnyAsync(x => x.PhoneNumber == phoneNumber)) return null;
        var role = request.Role.Trim();
        if (!role.Equals("Customer", StringComparison.OrdinalIgnoreCase) &&
            !role.Equals("Host", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Vai trò đăng ký chỉ có thể là Customer hoặc Host.");
        role = role.Equals("Host", StringComparison.OrdinalIgnoreCase) ? "Host" : "Customer";

        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = email,
            PhoneNumber = phoneNumber,
            PasswordHash = HashPassword(request.Password),
            Role = role,
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return ToResponse(user);
    }

    public async Task<(UserResponse User, string Token)?> LoginAsync(LoginRequest request)
    {
        var identifier = request.Identifier.Trim().ToLowerInvariant().Replace(" ", "");
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == identifier || x.PhoneNumber == identifier);
        if (user is null || user.Status != "Active" || string.IsNullOrWhiteSpace(user.PasswordHash)
            || !VerifyPassword(request.Password, user.PasswordHash)) return null;
        return (ToResponse(user), CreateToken(user));
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
