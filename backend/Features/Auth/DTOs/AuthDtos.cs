using System.ComponentModel.DataAnnotations;

namespace HomestayAuth.Api.Features.Auth.DTOs;

public sealed record RegisterRequest(
    [Required, MinLength(2), MaxLength(100)] string FullName,
    [Required, EmailAddress, MaxLength(255)] string Email,
    [Phone, MaxLength(20)] string? PhoneNumber,
    [Required, MinLength(8), MaxLength(100)] string Password,
    [Required] string Role);

public sealed record LoginRequest(
    [Required, MaxLength(255)] string Identifier,
    [Required] string Password);

public sealed record UserResponse(long Id, string FullName, string Email, string Role);
