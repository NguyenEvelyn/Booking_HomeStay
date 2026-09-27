namespace HomestayAuth.Api.Domain.Entities;

public static class CompensationStatus
{
    public const string Draft = "Draft";
    public const string PendingConfirmation = "PendingConfirmation";
    public const string PaymentPending = "PaymentPending";
    public const string Paid = "Paid";
    public const string Withdrawn = "Withdrawn";
}

public class CompensationCatalogItem
{
    public long Id { get; set; }
    public long HomestayId { get; set; }
    public required string Name { get; set; }
    public required string Category { get; set; }
    public string? Description { get; set; }
    public string Unit { get; set; } = "item";
    public decimal ReplacementCost { get; set; }
    public decimal MaximumCompensation { get; set; }
    public decimal DefaultDepreciationPercent { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime EffectiveFrom { get; set; }
    public long CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Homestay Homestay { get; set; } = null!;
}

public class CompensationClaim
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public required string Status { get; set; }
    public required string IncidentType { get; set; }
    public required string Description { get; set; }
    public DateTime IncidentAt { get; set; }
    public decimal RequestedAmount { get; set; }
    public decimal? ApprovedAmount { get; set; }
    public DateTime? ResponseDueAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public long CreatedBy { get; set; }
    public long? AdditionalChargeId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Booking Booking { get; set; } = null!;
    public AdditionalCharge? AdditionalCharge { get; set; }
    public ICollection<CompensationClaimItem> Items { get; set; } = [];
    public ICollection<CompensationEvidence> Evidence { get; set; } = [];
}

public class CompensationClaimItem
{
    public long Id { get; set; }
    public long ClaimId { get; set; }
    public long? CatalogItemId { get; set; }
    public required string ItemName { get; set; }
    public required string Category { get; set; }
    public required string DamageLevel { get; set; }
    public int Quantity { get; set; }
    public decimal UnitAmount { get; set; }
    public decimal DepreciationPercent { get; set; }
    public decimal RequestedAmount { get; set; }
    public string? Note { get; set; }
    public CompensationClaim Claim { get; set; } = null!;
    public CompensationCatalogItem? CatalogItem { get; set; }
}

public class CompensationEvidence
{
    public long Id { get; set; }
    public long ClaimId { get; set; }
    public required string Url { get; set; }
    public required string MediaType { get; set; }
    public string? Caption { get; set; }
    public long UploadedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public CompensationClaim Claim { get; set; } = null!;
}
