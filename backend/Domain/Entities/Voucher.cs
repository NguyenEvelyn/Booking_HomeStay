namespace HomestayAuth.Api.Domain.Entities;

public class Voucher
{
    public long Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public required string DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal? MaximumDiscount { get; set; }
    public decimal MinimumBookingAmount { get; set; }
    public DateTime ValidFrom { get; set; }
    public DateTime ValidUntil { get; set; }
    public int? UsageLimit { get; set; }
    public int UsageLimitPerCustomer { get; set; } = 1;
    public long? HomestayId { get; set; }
    // Who pays for the discount: "Platform" (Tripio reimburses the host) or "Host" (host's own promotion).
    public string FundedBy { get; set; } = VoucherFunding.Platform;
    // Private codes (customer care, targeted campaigns) are hidden from the public voucher list.
    public bool IsPublic { get; set; } = true;
    public string Status { get; set; } = "Active";
    public long? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class VoucherUsage
{
    public long Id { get; set; }
    public long VoucherId { get; set; }
    public long BookingId { get; set; }
    public long CustomerId { get; set; }
    public required string CodeUsed { get; set; }
    public decimal DiscountAmount { get; set; }
    // Snapshot of Voucher.FundedBy at booking time, so later edits never change past settlements.
    public string FundedBy { get; set; } = VoucherFunding.Platform;
    public DateTime UsedAt { get; set; }
}

public static class VoucherFunding
{
    public const string Platform = "Platform";
    public const string Host = "Host";
}
