using HomestayAuth.Api.Features.Auth.DTOs;

namespace HomestayAuth.Api.Features.Auth.Services;

public interface IAuthService
{
    Task<(UserResponse? User, string? VerificationCode)> RegisterAsync(RegisterRequest request);
    Task<(UserResponse? User, string? Token, string? Error)> LoginAsync(LoginRequest request);
    Task<bool> VerifyEmailAsync(VerifyEmailRequest request);
    Task<(string? Code, string? Error)> ResendVerificationAsync(string email);
    Task<string?> RequestPasswordResetAsync(string email);
    Task<(bool Success, string? Error)> ResetPasswordAsync(ResetPasswordRequest request);
    Task<(bool Success, string? Error)> ChangePasswordAsync(long userId, ChangePasswordRequest request);
    Task RevokeSessionsAsync(long userId);
    Task<(UserResponse User, string Token)> ExternalLoginAsync(string email, string fullName);
    Task<UserResponse?> GetUserAsync(long id);
}
