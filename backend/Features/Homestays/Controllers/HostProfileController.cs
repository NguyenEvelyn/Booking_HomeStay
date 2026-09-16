using System.Security.Claims;
using HomestayAuth.Api.Features.Homestays.DTOs;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Homestays.Controllers;

[ApiController, Route("api/host/profile"), Authorize(Roles = "Host")]
public sealed class HostProfileController(AppDbContext db, IWebHostEnvironment environment) : ControllerBase
{
    private long HostId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await db.Users.AsNoTracking().Where(x => x.Id == HostId)
        .Select(x => new { x.Id, x.FullName, x.Email, x.PhoneNumber, x.Bio, x.Address, x.AvatarUrl, x.CoverUrl, x.CreatedAt }).SingleAsync());

    [HttpPut]
    public async Task<IActionResult> Update(SaveHostProfileRequest request)
    {
        var user = await db.Users.SingleAsync(x => x.Id == HostId);
        user.FullName = request.FullName.Trim(); user.PhoneNumber = request.PhoneNumber?.Trim(); user.Bio = request.Bio?.Trim(); user.Address = request.Address?.Trim(); user.AvatarUrl = request.AvatarUrl; user.CoverUrl = request.CoverUrl; user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); return Ok(new { message = "Đã cập nhật hồ sơ Host." });
    }

    [HttpPost("upload")]
    [RequestSizeLimit(8_000_000)]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file.Length == 0 || file.Length > 8_000_000) return BadRequest(new { message = "Ảnh phải nhỏ hơn 8 MB." });
        var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" }; var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowed.Contains(extension)) return BadRequest(new { message = "Chỉ hỗ trợ JPG, PNG hoặc WEBP." });
        var folder = Path.Combine(environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot"), "uploads", "hosts", HostId.ToString()); Directory.CreateDirectory(folder);
        var fileName = $"{Guid.NewGuid():N}{extension}"; await using var stream = System.IO.File.Create(Path.Combine(folder, fileName)); await file.CopyToAsync(stream);
        var root = $"{Request.Scheme}://{Request.Host}"; return Ok(new { url = $"{root}/uploads/hosts/{HostId}/{fileName}" });
    }
}
