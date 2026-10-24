using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.RegularExpressions;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Auth.Controllers;

[ApiController, Route("api/account"), Authorize]
public sealed class AccountController(AppDbContext db, SupabaseStorageService storage) : ControllerBase
{
    private static readonly Regex PhonePattern = new(@"^0(3|5|7|8|9)\d{8}$", RegexOptions.Compiled);
    private long UserId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var profile = await db.Users.AsNoTracking()
            .Where(x => x.Id == UserId)
            .Select(x => new
            {
                x.Id,
                x.FullName,
                x.Email,
                x.PhoneNumber,
                x.AvatarUrl,
                x.Bio,
                x.Address,
                x.Role,
                x.CreatedAt,
                EmailVerified = x.EmailVerifiedAt != null,
                PhoneVerified = false
            })
            .SingleOrDefaultAsync();

        return profile is null
            ? NotFound(new { message = "Người dùng không tồn tại." })
            : Ok(profile);
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile(UpdateAccountProfileRequest request)
    {
        var fullName = request.FullName.Trim();
        var phone = NormalizePhone(request.PhoneNumber);
        if (fullName.Length is < 2 or > 100)
            return BadRequest(new { message = "Tên hiển thị phải từ 2 đến 100 ký tự." });
        if (!string.IsNullOrEmpty(phone) && !PhonePattern.IsMatch(phone))
            return BadRequest(new { message = "Số điện thoại Việt Nam không hợp lệ." });
        if (!string.IsNullOrEmpty(phone) && await db.Users.AnyAsync(x => x.Id != UserId && x.PhoneNumber == phone))
            return Conflict(new { message = "Số điện thoại đã được sử dụng bởi tài khoản khác." });

        var user = await db.Users.SingleAsync(x => x.Id == UserId);
        user.FullName = fullName;
        user.PhoneNumber = string.IsNullOrEmpty(phone) ? null : phone;
        user.Address = Clean(request.Address, 255);
        user.Bio = Clean(request.Bio, 1000);
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new
        {
            message = "Đã cập nhật hồ sơ của bạn.",
            profile = new
            {
                user.Id, user.FullName, user.Email, user.PhoneNumber, user.AvatarUrl,
                user.Bio, user.Address, user.Role, user.CreatedAt,
                EmailVerified = user.EmailVerifiedAt != null,
                PhoneVerified = false
            }
        });
    }

    [HttpPost("avatar")]
    [RequestSizeLimit(8_000_000)]
    public async Task<IActionResult> UploadAvatar(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length == 0 || file.Length > ImageUpload.MaxBytes)
            return BadRequest(new { message = "Ảnh đại diện phải nhỏ hơn 8 MB." });

        if (await ImageUpload.Validate(file, cancellationToken) is not (var extension, var contentType))
            return BadRequest(new { message = "Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP hợp lệ." });

        var user = await db.Users.SingleAsync(x => x.Id == UserId);
        var oldAvatar = user.AvatarUrl;
        var objectPath = $"profiles/{UserId}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{extension}";
        await using var stream = file.OpenReadStream();
        var url = await storage.UploadPublicImageAsync(stream, objectPath, contentType, cancellationToken);
        user.AvatarUrl = url;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(oldAvatar))
            await storage.DeletePublicImageIfManagedAsync(oldAvatar, cancellationToken);

        return Ok(new { message = "Đã cập nhật ảnh đại diện.", url });
    }

    private static string NormalizePhone(string? value)
    {
        var normalized = (value ?? "").Trim().Replace(" ", "").Replace(".", "").Replace("-", "");
        return normalized.StartsWith("+84") ? $"0{normalized[3..]}" : normalized;
    }

    private static string? Clean(string? value, int maxLength)
    {
        var cleaned = value?.Trim();
        if (string.IsNullOrEmpty(cleaned)) return null;
        return cleaned.Length <= maxLength ? cleaned : cleaned[..maxLength];
    }

}

public sealed class UpdateAccountProfileRequest
{
    [Required]
    public string FullName { get; init; } = "";
    public string? PhoneNumber { get; init; }
    public string? Address { get; init; }
    public string? Bio { get; init; }
}
