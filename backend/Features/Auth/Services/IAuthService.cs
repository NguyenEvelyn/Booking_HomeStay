using HomestayAuth.Api.Features.Auth.DTOs;

namespace HomestayAuth.Api.Features.Auth.Services;

public interface IAuthService
{
    Task<(UserResponse? User, string? VerificationCode)> RegisterAsync(RegisterRequest request);
    Task<(UserResponse? User, string? Token, string? Error)> LoginAsync(LoginRequest request);
    Task<bool> VerifyEmailAsync(VerifyEmailRequest request);
    Task<string?> ResendVerificationAsync(string email);
    Task<(UserResponse User, string Token)> ExternalLoginAsync(string email, string fullName);
    Task<UserResponse?> GetUserAsync(long id);
}
