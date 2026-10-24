using System.Security.Claims;
using HomestayAuth.Api.Features.Homestays.DTOs;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Homestays.Controllers;

[ApiController, Route("api/host/profile"), Authorize(Roles = "Host")]
public sealed class HostProfileController(AppDbContext db, SupabaseStorageService storage) : ControllerBase
{
    private long HostId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await db.Users.AsNoTracking().Where(x => x.Id == HostId)
        .Select(x => new { x.Id, x.FullName, x.Email, x.PhoneNumber, x.Bio, x.Address, x.AvatarUrl, x.CoverUrl, x.CreatedAt }).SingleAsync());

    [HttpPut]
    public async Task<IActionResult> Update(SaveHostProfileRequest request)
    {
        var user = await db.Users.SingleAsync(x => x.Id == HostId);
        // Keep an existing (possibly legacy) image unchanged; any new value must be a valid web link.
        if (!string.IsNullOrWhiteSpace(request.AvatarUrl) && request.AvatarUrl != user.AvatarUrl && !ImageUpload.IsAllowedUrl(request.AvatarUrl))
            return BadRequest(new { message = "Đường dẫn ảnh đại diện không hợp lệ." });
        if (!string.IsNullOrWhiteSpace(request.CoverUrl) && request.CoverUrl != user.CoverUrl && !ImageUpload.IsAllowedUrl(request.CoverUrl))
            return BadRequest(new { message = "Đường dẫn ảnh bìa không hợp lệ." });
        user.FullName = request.FullName.Trim(); user.PhoneNumber = request.PhoneNumber?.Trim(); user.Bio = request.Bio?.Trim(); user.Address = request.Address?.Trim(); user.AvatarUrl = request.AvatarUrl; user.CoverUrl = request.CoverUrl; user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); return Ok(new { message = "Đã cập nhật hồ sơ Host." });
    }

    [HttpPost("upload")]
    [RequestSizeLimit(8_000_000)]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length == 0 || file.Length > ImageUpload.MaxBytes) return BadRequest(new { message = "Ảnh phải nhỏ hơn 8 MB." });
        if (await ImageUpload.Validate(file, cancellationToken) is not (var extension, var contentType))
            return BadRequest(new { message = "Chỉ hỗ trợ JPG, PNG hoặc WEBP hợp lệ." });

        var objectPath = $"hosts/{HostId}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{extension}";
        await using var stream = file.OpenReadStream();
        var url = await storage.UploadPublicImageAsync(stream, objectPath, contentType, cancellationToken);
        return Ok(new { url });
    }
}
