namespace HomestayAuth.Api.Domain.Entities;

public class User
{
    public long Id { get; set; }
    public required string FullName { get; set; }
    public required string Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? AvatarUrl { get; set; }
    public string? CoverUrl { get; set; }
    public string? Bio { get; set; }
    public string? Address { get; set; }
    public string? TravelFirstName { get; set; }
    public string? TravelLastName { get; set; }
    public string? TravelEmail { get; set; }
    public string? TravelCountry { get; set; }
    public string? TravelPhoneCountryCode { get; set; }
    public string? TravelPhone { get; set; }
    public DateOnly? TravelBirthDate { get; set; }
    public string? TravelGender { get; set; }
    public string? TravelDocumentType { get; set; }
    public string? ProtectedTravelDocumentNumber { get; set; }
    public int? TravelProvinceCode { get; set; }
    public string? TravelProvinceName { get; set; }
    public int? TravelWardCode { get; set; }
    public string? TravelWardName { get; set; }
    public string? TravelStreet { get; set; }
    public string? TravelAddress { get; set; }
    public DateTime? TravelDocumentStorageConsentAt { get; set; }
    public string? PasswordHash { get; set; }
    public required string Role { get; set; }
    public required string Status { get; set; }
    public string? EmailVerificationCodeHash { get; set; }
    public DateTime? EmailVerificationExpiresAt { get; set; }
    public DateTime? EmailVerificationSentAt { get; set; }
    public DateTime? EmailVerifiedAt { get; set; }
    public int EmailVerificationFailedAttempts { get; set; }
    public string? PasswordResetCodeHash { get; set; }
    public DateTime? PasswordResetExpiresAt { get; set; }
    public DateTime? PasswordResetSentAt { get; set; }
    public int PasswordResetFailedAttempts { get; set; }
    public int AuthVersion { get; set; }
    public int FailedLoginAttempts { get; set; }
    public DateTime? LockoutEnd { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
