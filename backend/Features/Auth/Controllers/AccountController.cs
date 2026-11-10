using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.RegularExpressions;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace HomestayAuth.Api.Features.Auth.Controllers;

[ApiController, Route("api/account"), Authorize]
public sealed class AccountController(AppDbContext db, SupabaseStorageService storage, IDataProtectionProvider dataProtection) : ControllerBase
{
    private static readonly Regex PhonePattern = new(@"^0(3|5|7|8|9)\d{8}$", RegexOptions.Compiled);
    private readonly IDataProtector _travelDocumentProtector = dataProtection.CreateProtector("Tripio.Account.TravelDocument.v1");
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

    [HttpGet("travel-profile")]
    public async Task<IActionResult> GetTravelProfile()
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == UserId);
        if (user is null) return NotFound(new { message = "Người dùng không tồn tại." });

        string? documentNumber = null;
        if (user.TravelDocumentStorageConsentAt is not null && !string.IsNullOrWhiteSpace(user.ProtectedTravelDocumentNumber))
        {
            try { documentNumber = _travelDocumentProtector.Unprotect(user.ProtectedTravelDocumentNumber); }
            catch (CryptographicException) { /* A lost or rotated key must not expose the stored cipher as plaintext. */ }
        }

        return Ok(new
        {
            firstName = user.TravelFirstName,
            lastName = user.TravelLastName,
            email = user.TravelEmail,
            country = user.TravelCountry,
            countryCode = user.TravelPhoneCountryCode,
            phone = user.TravelPhone,
            birthDate = user.TravelBirthDate?.ToString("yyyy-MM-dd"),
            gender = user.TravelGender,
            documentType = user.TravelDocumentType,
            documentNumber,
            provinceCode = user.TravelProvinceCode,
            provinceName = user.TravelProvinceName,
            wardCode = user.TravelWardCode,
            wardName = user.TravelWardName,
            street = user.TravelStreet,
            address = user.TravelAddress,
            documentStorageConsented = user.TravelDocumentStorageConsentAt is not null
        });
    }

    [HttpPut("travel-profile")]
    public async Task<IActionResult> UpdateTravelProfile(UpdateTravelProfileRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Email) && !new EmailAddressAttribute().IsValid(request.Email))
            return BadRequest(new { message = "Email lưu trú không hợp lệ." });
        var phone = Regex.Replace(request.Phone ?? "", @"\D", "");
        if (!string.IsNullOrWhiteSpace(phone) && !Regex.IsMatch(phone, @"^\d{8,15}$"))
            return BadRequest(new { message = "Số điện thoại lưu trú phải có 8–15 chữ số." });
        if (request.ProvinceCode is not > 0 || request.WardCode is not > 0
            || string.IsNullOrWhiteSpace(request.ProvinceName) || string.IsNullOrWhiteSpace(request.WardName)
            || string.IsNullOrWhiteSpace(request.Street))
            return BadRequest(new { message = "Vui lòng chọn tỉnh/thành, phường/xã và nhập số nhà, tên đường." });

        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == UserId);
        if (user is null) return NotFound(new { message = "Người dùng không tồn tại." });
        var documentNumber = request.DocumentNumber?.Trim();
        if (!string.IsNullOrEmpty(documentNumber))
        {
            if (!user.TravelDocumentStorageConsentAt.HasValue && !request.AllowDocumentNumberStorage)
                return BadRequest(new { message = "Cần có sự đồng ý rõ ràng trước khi lưu số giấy tờ vào hồ sơ." });
            user.TravelDocumentStorageConsentAt ??= DateTime.UtcNow;
            user.ProtectedTravelDocumentNumber = _travelDocumentProtector.Protect(documentNumber);
        }

        user.TravelFirstName = Clean(request.FirstName, 100);
        user.TravelLastName = Clean(request.LastName, 100);
        user.TravelEmail = Clean(request.Email, 255);
        user.TravelCountry = Clean(request.Country, 80);
        user.TravelPhoneCountryCode = Clean(request.CountryCode, 6);
        user.TravelPhone = Clean(phone, 20);
        user.TravelBirthDate = request.BirthDate;
        user.TravelGender = Clean(request.Gender, 20);
        user.TravelDocumentType = Clean(request.DocumentType, 30);
        user.TravelProvinceCode = request.ProvinceCode;
        user.TravelProvinceName = Clean(request.ProvinceName, 100);
        user.TravelWardCode = request.WardCode;
        user.TravelWardName = Clean(request.WardName, 100);
        user.TravelStreet = Clean(request.Street, 255);
        user.TravelAddress = Clean(string.Join(", ", new[] { request.Street, request.WardName, request.ProvinceName }
            .Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value!.Trim())), 500);
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã lưu thông tin lưu trú vào hồ sơ của bạn.", documentStorageConsented = user.TravelDocumentStorageConsentAt is not null });
    }

    [HttpDelete("travel-profile/document")]
    public async Task<IActionResult> DeleteTravelDocument()
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == UserId);
        if (user is null) return NotFound(new { message = "Người dùng không tồn tại." });
        user.ProtectedTravelDocumentNumber = null;
        user.TravelDocumentStorageConsentAt = null;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã xóa số giấy tờ lưu trong hồ sơ." });
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

public sealed class UpdateTravelProfileRequest
{
    [MaxLength(100)] public string? FirstName { get; init; }
    [MaxLength(100)] public string? LastName { get; init; }
    [MaxLength(255)] public string? Email { get; init; }
    [MaxLength(80)] public string? Country { get; init; }
    [MaxLength(6)] public string? CountryCode { get; init; }
    [MaxLength(20)] public string? Phone { get; init; }
    public DateOnly? BirthDate { get; init; }
    [MaxLength(20)] public string? Gender { get; init; }
    [MaxLength(30)] public string? DocumentType { get; init; }
    [MaxLength(50)] public string? DocumentNumber { get; init; }
    public int? ProvinceCode { get; init; }
    [MaxLength(100)] public string? ProvinceName { get; init; }
    public int? WardCode { get; init; }
    [MaxLength(100)] public string? WardName { get; init; }
    [MaxLength(255)] public string? Street { get; init; }
    public bool AllowDocumentNumberStorage { get; init; }
}
