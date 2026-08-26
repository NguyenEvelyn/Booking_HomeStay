using HomestayAuth.Api.Features.Auth.DTOs;

namespace HomestayAuth.Api.Features.Auth.Services;

public interface IAuthService
{
    Task<UserResponse?> RegisterAsync(RegisterRequest request);
    Task<(UserResponse User, string Token)?> LoginAsync(LoginRequest request);
    Task<UserResponse?> GetUserAsync(long id);
}
