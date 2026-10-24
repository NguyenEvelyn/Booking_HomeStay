namespace HomestayAuth.Api.Domain.Entities;

public sealed record OperationalPolicyDocument
{
    public CheckInOutPolicy CheckInOut { get; init; } = new();
    public GuestPolicy Guests { get; init; } = new();
    public PaymentPolicy Payment { get; init; } = new();
    public DateChangePolicy DateChange { get; init; } = new();
    public RoomChangePolicy RoomChange { get; init; } = new();
    public DayUsePolicy DayUse { get; init; } = new();
    public BreakfastPolicy Breakfast { get; init; } = new();
    public VehiclePolicy Vehicle { get; init; } = new();
    public PetPolicy Pets { get; init; } = new();
    public AssetPolicy Assets { get; init; } = new();
    public HouseRulesPolicy HouseRules { get; init; } = new();
    public PromotionPolicy Promotions { get; init; } = new();
    public NoShowPolicy NoShow { get; init; } = new();
    public MinibarPolicy Minibar { get; init; } = new();
    public ServiceCatalogPolicy Services { get; init; } = new();
    public IReadOnlyList<SeasonalSurchargeRule> SeasonalSurcharges { get; init; } = DefaultSeasonalSurcharges();

    public static OperationalPolicyDocument SunriseGardenDefault() => new();

    private static IReadOnlyList<SeasonalSurchargeRule> DefaultSeasonalSurcharges() =>
    [
        new() { Code = "Weekend", Name = "Cuối tuần", Percent = 10, DaysOfWeek = [DayOfWeek.Saturday, DayOfWeek.Sunday] }
    ];
}

public sealed record CheckInOutPolicy
{
    public TimeOnly CheckInTime { get; init; } = new(14, 0);
    public TimeOnly CheckOutTime { get; init; } = new(12, 0);
    public IReadOnlyList<TimeFeeTier> EarlyCheckInTiers { get; init; } =
    [
        new() { From = new(0, 0), To = new(6, 0), Percent = 100 },
        new() { From = new(6, 0), To = new(10, 0), Percent = 50 },
        new() { From = new(10, 0), To = new(14, 0), Percent = 0 }
    ];
    public IReadOnlyList<TimeFeeTier> LateCheckOutTiers { get; init; } =
    [
        new() { From = new(12, 0), To = new(15, 0), Percent = 30 },
        new() { From = new(15, 0), To = new(18, 0), Percent = 50 },
        new() { From = new(18, 0), To = new(23, 59), Percent = 100 }
    ];
}

public sealed record TimeFeeTier
{
    public TimeOnly From { get; init; }
    public TimeOnly To { get; init; }
    public decimal Percent { get; init; }
}

public sealed record GuestPolicy
{
    public int AdultAge { get; init; } = 12;
    public decimal HeightFallbackMeters { get; init; } = 1.2m;
    public IReadOnlyList<ChildFeeTier> ChildFeeTiers { get; init; } =
    [
        new() { MinimumAge = 0, MaximumAgeExclusive = 2, Percent = 0 },
        new() { MinimumAge = 2, MaximumAgeExclusive = 6, Percent = 10 },
        new() { MinimumAge = 6, MaximumAgeExclusive = 10, Percent = 15 },
        new() { MinimumAge = 10, MaximumAgeExclusive = 12, Percent = 30 }
    ];
    public decimal BabyCotFee { get; init; }
    public decimal ChildExtraBedFee { get; init; } = 100_000;
    public decimal AdultExtraBedFee { get; init; } = 200_000;
    public decimal ExtraBeddingFee { get; init; } = 50_000;
}

public sealed record ChildFeeTier
{
    public int MinimumAge { get; init; }
    public int MaximumAgeExclusive { get; init; }
    public decimal Percent { get; init; }
}

public sealed record PaymentPolicy
{
    public decimal StandardDepositPercent { get; init; } = 30;
    public decimal VillaDepositPercent { get; init; } = 50;
    public decimal HolidayDepositPercent { get; init; } = 50;
    public bool HighestDepositRuleWins { get; init; } = true;
    public int RefundProcessingMinimumBusinessDays { get; init; } = 3;
    public int RefundProcessingMaximumBusinessDays { get; init; } = 15;
}

public sealed record DateChangePolicy
{
    public int MaximumChanges { get; init; } = 1;
    public int FreeBeforeDays { get; init; } = 7;
    public decimal FeeFromThreeToSixDaysPercent { get; init; } = 10;
    public decimal FeeUnderThreeDaysPercent { get; init; } = 20;
    public string LowerPriceDifferenceMode { get; init; } = "Voucher";
    public int VoucherValidityMonths { get; init; } = 6;
}

public sealed record RoomChangePolicy
{
    public int FreeBeforeHours { get; init; } = 24;
    public decimal LateOrDuringStayFee { get; init; } = 100_000;
    public bool FreeUpgradeForHomestayFault { get; init; } = true;
    public bool RefundDowngradeForHomestayFault { get; init; } = true;
}

public sealed record DayUsePolicy
{
    public bool Enabled { get; init; } = true;
    public TimeOnly From { get; init; } = new(9, 0);
    public TimeOnly To { get; init; } = new(18, 0);
    public decimal UpToThreeHoursPercent { get; init; } = 40;
    public decimal UpToSixHoursPercent { get; init; } = 60;
    public decimal OverSixHoursPercent { get; init; } = 80;
    public decimal DepositPercent { get; init; } = 50;
    public int NonRefundableCancellationWindowHours { get; init; } = 3;
}

public sealed record BreakfastPolicy
{
    public TimeOnly From { get; init; } = new(6, 30);
    public TimeOnly To { get; init; } = new(9, 30);
    public decimal AdultPrice { get; init; } = 100_000;
    public decimal ChildPrice { get; init; } = 60_000;
    public int ChildFreeUnderAge { get; init; } = 6;
    public int FreeFromNights { get; init; } = 3;
    public bool FreeForVilla { get; init; } = true;
}

public sealed record VehiclePolicy
{
    public decimal ManualMotorbikeDailyPrice { get; init; } = 120_000;
    public decimal ScooterDailyPrice { get; init; } = 160_000;
    public decimal ElectricBikeDailyPrice { get; init; } = 180_000;
    public decimal VehicleDeposit { get; init; } = 500_000;
    public decimal AirportPickupPrice { get; init; } = 300_000;
    public decimal AirportDropoffPrice { get; init; } = 300_000;
}

public sealed record PetPolicy
{
    public bool Allowed { get; init; } = true;
    public int MaximumPerRoom { get; init; } = 1;
    public decimal FeePerNight { get; init; } = 150_000;
}

public sealed record AssetPolicy
{
    public decimal MinimumDeposit { get; init; } = 500_000;
    public decimal MaximumDeposit { get; init; } = 2_000_000;
    public decimal TowelReplacement { get; init; } = 150_000;
    public decimal TvRemoteReplacement { get; init; } = 300_000;
    public decimal KeyReplacement { get; init; } = 200_000;
    public IReadOnlyList<AssetCompensationItemPolicy> Items { get; init; } =
    [
        new() { Name = "Mất / hỏng Chìa khóa / Thẻ từ", UnitPrice = 200_000 },
        new() { Name = "Mất / hỏng Điều khiển TV / Máy lạnh", UnitPrice = 300_000 },
        new() { Name = "Làm ố bẩn / hỏng Khăn tắm, khăn mặt", UnitPrice = 150_000 },
        new() { Name = "Làm vỡ ly, cốc thủy tinh / tách gốm", UnitPrice = 50_000 },
        new() { Name = "Bẩn ga trải giường / nệm cần giặt tẩy", UnitPrice = 250_000 }
    ];
}

public sealed record AssetCompensationItemPolicy
{
    public string Name { get; init; } = "";
    public decimal UnitPrice { get; init; }
}

public sealed record MinibarPolicy
{
    public bool Enabled { get; init; } = true;
    public IReadOnlyList<MinibarItemPolicy> Items { get; init; } =
    [
        new() { Name = "Nước suối Aquafina/Lavie (500ml)", UnitPrice = 15_000 },
        new() { Name = "Coca Cola / Pepsi / 7Up (Lon)", UnitPrice = 20_000 },
        new() { Name = "Bia lon Heineken / Tiger", UnitPrice = 30_000 },
        new() { Name = "Mì ly ăn liền", UnitPrice = 25_000 },
        new() { Name = "Snack khoai tây / Hạt điều", UnitPrice = 20_000 }
    ];
}

public sealed record MinibarItemPolicy
{
    public string Name { get; init; } = "";
    public decimal UnitPrice { get; init; }
}

public sealed record ServiceCatalogPolicy
{
    public bool Enabled { get; init; } = true;
    public IReadOnlyList<ServiceCatalogItemPolicy> Items { get; init; } =
    [
        new() { Name = "Bữa sáng buffet / Alacarte", UnitPrice = 100_000, Unit = "suất" },
        new() { Name = "Thuê xe máy tay ga (AirBlade/Vision)", UnitPrice = 160_000, Unit = "ngày" },
        new() { Name = "Thuê xe máy số (Wave/Sirius)", UnitPrice = 120_000, Unit = "ngày" },
        new() { Name = "Đưa đón sân bay (1 chiều)", UnitPrice = 300_000, Unit = "chuyến" },
        new() { Name = "Bếp nướng BBQ & than hoa ngoài trời", UnitPrice = 200_000, Unit = "lần" },
        new() { Name = "Giặt sấy quần áo nhanh", UnitPrice = 50_000, Unit = "kg" }
    ];
}

public sealed record ServiceCatalogItemPolicy
{
    public string Name { get; init; } = "";
    public decimal UnitPrice { get; init; }
    public string Unit { get; init; } = "lượt";
}

public sealed record HouseRulesPolicy
{
    public TimeOnly QuietHoursFrom { get; init; } = new(22, 0);
    public TimeOnly QuietHoursTo { get; init; } = new(7, 0);
    public bool SmokingInRoomAllowed { get; init; }
    public bool PartiesRequireApproval { get; init; } = true;
    public decimal MinimumPartyFee { get; init; } = 300_000;
    public decimal MaximumPartyFee { get; init; } = 1_000_000;
    public int FreeLuggageStorageHoursAfterCheckout { get; init; } = 6;
    public decimal LuggageFeePerItemPerDay { get; init; } = 50_000;
}

// What happens when a confirmed guest neither checks in nor cancels. Snapshotted into each booking.
public sealed record NoShowPolicy
{
    // Hours after the check-in time before the host may release the room.
    public int GraceHours { get; init; } = 6;
    // "Deposit": the host keeps the deposit; "FirstNight": the host keeps one night's price.
    public string Penalty { get; init; } = NoShowPenalty.Deposit;
    // Share of what the guest paid beyond the penalty that is refunded.
    public decimal RemainingRefundPercent { get; init; } = 100;
}

public static class NoShowPenalty
{
    public const string Deposit = "Deposit";
    public const string FirstNight = "FirstNight";
}

public sealed record PromotionPolicy
{
    public bool StackableByDefault { get; init; }
    public int EarlyBirdMinimumDays { get; init; } = 30;
    public decimal EarlyBirdPercent { get; init; } = 15;
    public int LongStayMinimumNights { get; init; } = 5;
    public decimal LongStayPercent { get; init; } = 10;
    public int ExtendedStayMinimumNights { get; init; } = 7;
    public decimal ExtendedStayPercent { get; init; } = 15;
}

public sealed record SeasonalSurchargeRule
{
    public required string Code { get; init; }
    public required string Name { get; init; }
    public decimal Percent { get; init; }
    public DateOnly? StartDate { get; init; }
    public DateOnly? EndDate { get; init; }
    public IReadOnlyList<DayOfWeek> DaysOfWeek { get; init; } = [];
    public bool RequiresHolidayDeposit { get; init; }
}

