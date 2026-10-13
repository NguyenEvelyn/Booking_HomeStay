using System;

namespace HomestayAuth.Api.Domain.Entities;

public class HostRegistration
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string? PhoneNumber { get; set; }
    public string? IdCardNumber { get; set; }
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankAccountName { get; set; }
    public string? HomestayDataJson { get; set; }
    public string Status { get; set; } = "Pending";
    public string? RejectionReason { get; set; }
    public long? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}
