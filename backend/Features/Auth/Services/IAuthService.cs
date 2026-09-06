using HomestayAuth.Api.Features.Auth.DTOs;

namespace HomestayAuth.Api.Features.Auth.Services;

public interface IAuthService
{
    Task<UserResponse?> RegisterAsync(RegisterRequest request);
    Task<(UserResponse User, string Token)?> LoginAsync(LoginRequest request);
    Task<(UserResponse User, string Token)> ExternalLoginAsync(string email, string fullName);
    Task<UserResponse?> GetUserAsync(long id);
}
