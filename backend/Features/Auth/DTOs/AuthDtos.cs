using System.ComponentModel.DataAnnotations;

namespace HomestayAuth.Api.Features.Auth.DTOs;

public sealed record RegisterRequest(
    [Required, MinLength(2), MaxLength(100)] string FullName,
    [Required, EmailAddress, MaxLength(255)] string Email,
    [Required, MinLength(8), MaxLength(100)] string Password,
    [Required] string Role);

public sealed record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public sealed record UserResponse(long Id, string FullName, string Email, string Role);
