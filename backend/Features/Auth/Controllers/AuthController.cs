using System.Security.Claims;
using HomestayAuth.Api.Features.Auth.DTOs;
using HomestayAuth.Api.Features.Auth.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HomestayAuth.Api.Features.Auth.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService, IWebHostEnvironment environment) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        UserResponse? user;
        try { user = await authService.RegisterAsync(request); }
        catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
        return user is null
            ? Conflict(new { message = "Email đã được sử dụng." })
            : StatusCode(201, new { message = "Đăng ký thành công.", user });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var result = await authService.LoginAsync(request);
        if (result is null) return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });
        Response.Cookies.Append("token", result.Value.Token, CookieOptions());
        return Ok(new { message = "Đăng nhập thành công.", user = result.Value.User });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await authService.GetUserAsync(userId);
        return user is null ? NotFound(new { message = "Người dùng không tồn tại." }) : Ok(new { user });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("token", CookieOptions());
        return Ok(new { message = "Đăng xuất thành công." });
    }

    private CookieOptions CookieOptions() => new()
    {
        HttpOnly = true,
        Secure = environment.IsProduction(),
        SameSite = environment.IsProduction() ? SameSiteMode.None : SameSiteMode.Lax,
        Expires = DateTimeOffset.UtcNow.AddMilliseconds(
            double.TryParse(Environment.GetEnvironmentVariable("COOKIE_MAX_AGE_MS"), out var age) ? age : 86_400_000)
    };
}
