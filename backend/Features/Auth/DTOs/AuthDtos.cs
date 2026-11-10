using System.ComponentModel.DataAnnotations;

namespace HomestayAuth.Api.Features.Auth.DTOs;

public sealed class RegisterRequest
{
    [Required, MinLength(2), MaxLength(100)]
    public string FullName { get; init; } = "";

    [Required, EmailAddress, MaxLength(255), RegularExpression(@"^(?!\.)(?!.*\.\.)[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$", ErrorMessage = "Email không hợp lệ.")]
    public string Email { get; init; } = "";

    [Required, RegularExpression(@"^(0[35789]\d{8}|\+84[35789]\d{8})$", ErrorMessage = "Số điện thoại Việt Nam không hợp lệ.")]
    public string PhoneNumber { get; init; } = "";

    [Required, MinLength(8), MaxLength(32), RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$", ErrorMessage = "Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt.")]
    public string Password { get; init; } = "";

    [Required, Compare(nameof(Password), ErrorMessage = "Mật khẩu xác nhận không khớp.")]
    public string ConfirmPassword { get; init; } = "";

    [Required]
    public string Role { get; init; } = "Customer";
}

public sealed record LoginRequest(
    [Required, MaxLength(255)] string Identifier,
    [Required] string Password,
    bool Remember = false);

public sealed record VerifyEmailRequest(
    [Required, EmailAddress] string Email,
    [Required, RegularExpression(@"^\d{6}$", ErrorMessage = "Mã OTP phải gồm 6 chữ số.")] string Code);

public sealed record ResendVerificationRequest([Required, EmailAddress] string Email);

public sealed record ForgotPasswordRequest([Required, EmailAddress, MaxLength(255)] string Email);

public sealed class ResetPasswordRequest
{
    [Required, EmailAddress, MaxLength(255)]
    public string Email { get; init; } = "";

    [Required, RegularExpression(@"^\d{6}$", ErrorMessage = "Mã OTP phải gồm 6 chữ số.")]
    public string Code { get; init; } = "";

    [Required, MinLength(8), MaxLength(32), RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$", ErrorMessage = "Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt.")]
    public string NewPassword { get; init; } = "";

    [Required, Compare(nameof(NewPassword), ErrorMessage = "Mật khẩu xác nhận không khớp.")]
    public string ConfirmPassword { get; init; } = "";
}

public sealed class ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; init; } = "";

    [Required, MinLength(8), MaxLength(32), RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$", ErrorMessage = "Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt.")]
    public string NewPassword { get; init; } = "";

    [Required, Compare(nameof(NewPassword), ErrorMessage = "Mật khẩu xác nhận không khớp.")]
    public string ConfirmPassword { get; init; } = "";
}

public sealed record UserResponse(long Id, string FullName, string Email, string Role, string? PhoneNumber);
