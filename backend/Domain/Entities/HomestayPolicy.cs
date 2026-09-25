namespace HomestayAuth.Api.Domain.Entities;

public class HomestayPolicy
{
    public long Id { get; set; }
    public long HomestayId { get; set; }
    public int Version { get; set; }
    public int HoldMinutes { get; set; } = 15;
    public int ReviewCreateDays { get; set; } = 14;
    public int ReviewEditDays { get; set; } = 14;
    public decimal CommissionRate { get; set; } = .10m;
    public required string GuestDowngradeRefundMode { get; set; }
    public decimal GuestDowngradeRefundPercent { get; set; }
    public bool AutoApproveLateCheckoutWithoutNextBooking { get; set; } = true;
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public required string Status { get; set; }
    public long CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public ICollection<CancellationPolicyTier> CancellationTiers { get; set; } = [];
    public ICollection<LateCheckoutFeeTier> LateCheckoutTiers { get; set; } = [];
}

public class CancellationPolicyTier
{
    public long Id { get; set; }
    public long PolicyId { get; set; }
    public int MinimumDays { get; set; }
    public int? MaximumDays { get; set; }
    public decimal RefundPercent { get; set; }
    public HomestayPolicy Policy { get; set; } = null!;
}

public class LateCheckoutFeeTier
{
    public long Id { get; set; }
    public long PolicyId { get; set; }
    public int FromMinutes { get; set; }
    public int? ToMinutes { get; set; }
    public required string CalculationType { get; set; }
    public decimal Value { get; set; }
    public HomestayPolicy Policy { get; set; } = null!;
}
