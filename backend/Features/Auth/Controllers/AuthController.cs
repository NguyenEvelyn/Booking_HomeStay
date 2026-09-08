using System.Security.Claims;
using HomestayAuth.Api.Features.Auth.DTOs;
using HomestayAuth.Api.Features.Auth.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HomestayAuth.Api.Features.Auth.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService, IWebHostEnvironment environment, IAuthenticationSchemeProvider schemes) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        (UserResponse? User, string? VerificationCode) result;
        try { result = await authService.RegisterAsync(request); }
        catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
        return result.User is null
            ? Conflict(new { message = "Email hoặc số điện thoại đã được sử dụng." })
            : StatusCode(201, new
            {
                message = "Đăng ký thành công. Vui lòng nhập mã OTP đã gửi đến email.",
                user = result.User,
                requiresVerification = true,
                developmentOtp = environment.IsDevelopment() ? result.VerificationCode : null
            });
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var result = await authService.LoginAsync(request);
        if (result.User is null) return Unauthorized(new { message = result.Error });
        Response.Cookies.Append("token", result.Token!, CookieOptions());
        return Ok(new { message = "Đăng nhập thành công.", user = result.User });
    }

    [HttpPost("verify-email")]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> VerifyEmail(VerifyEmailRequest request) =>
        await authService.VerifyEmailAsync(request)
            ? Ok(new { message = "Xác minh email thành công. Bạn có thể đăng nhập." })
            : BadRequest(new { message = "Mã OTP không đúng hoặc đã hết hạn." });

    [HttpPost("resend-verification")]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> ResendVerification(ResendVerificationRequest request)
    {
        var code = await authService.ResendVerificationAsync(request.Email);
        return code is null
            ? BadRequest(new { message = "Không thể gửi lại mã xác minh." })
            : Ok(new
            {
                message = "Đã gửi lại mã OTP xác minh.",
                developmentOtp = environment.IsDevelopment() ? code : null
            });
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

    [HttpGet("external/{provider}")]
    public async Task<IActionResult> ExternalLogin(string provider)
    {
        provider = provider.Equals("google", StringComparison.OrdinalIgnoreCase) ? "Google"
            : provider.Equals("facebook", StringComparison.OrdinalIgnoreCase) ? "Facebook" : "";
        if (string.IsNullOrEmpty(provider)) return BadRequest(new { message = "Nhà cung cấp không hợp lệ." });
        if (await schemes.GetSchemeAsync(provider) is null)
            return StatusCode(503, new { message = $"Chưa cấu hình đăng nhập {provider}." });
        var callback = Url.ActionLink(nameof(ExternalCallback), values: new { provider })!;
        return Challenge(new AuthenticationProperties { RedirectUri = callback }, provider);
    }

    [HttpGet("external/callback")]
    public async Task<IActionResult> ExternalCallback(string provider)
    {
        var result = await HttpContext.AuthenticateAsync("External");
        var email = result.Principal?.FindFirstValue(ClaimTypes.Email);
        var name = result.Principal?.FindFirstValue(ClaimTypes.Name) ?? "";
        var clientUrl = Environment.GetEnvironmentVariable("CLIENT_URL") ?? "http://localhost:5173";
        if (!result.Succeeded || string.IsNullOrWhiteSpace(email))
            return Redirect($"{clientUrl}?auth=error");

        var login = await authService.ExternalLoginAsync(email, name);
        Response.Cookies.Append("token", login.Token, CookieOptions());
        await HttpContext.SignOutAsync("External");
        return Redirect($"{clientUrl}?auth=success&provider={Uri.EscapeDataString(provider)}");
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
