using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record CancellationTierSnapshot(int MinimumDays, int? MaximumDays, decimal RefundPercent);
public sealed record LateTierSnapshot(int FromMinutes, int? ToMinutes, string CalculationType, decimal Value);
public sealed record BookingPolicySnapshot(long? PolicyId, int Version, int HoldMinutes, int ReviewCreateDays, int ReviewEditDays,
    decimal CommissionRate, string GuestDowngradeRefundMode, decimal GuestDowngradeRefundPercent,
    bool AutoApproveLateCheckoutWithoutNextBooking, IReadOnlyList<CancellationTierSnapshot> CancellationTiers,
    IReadOnlyList<LateTierSnapshot> LateCheckoutTiers)
{
    public OperationalPolicyDocument? Document { get; init; }
}

public sealed class PolicyService(AppDbContext db)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<BookingPolicySnapshot> Resolve(long homestayId, DateTime now)
    {
        var policy = await db.HomestayPolicies.AsNoTracking().Include(x => x.CancellationTiers).Include(x => x.LateCheckoutTiers)
            .Where(x => x.HomestayId == homestayId && x.Status == "Active" && x.EffectiveFrom <= now && (x.EffectiveTo == null || x.EffectiveTo > now))
            .OrderByDescending(x => x.Version).FirstOrDefaultAsync();
        if (policy is not null) return ToSnapshot(policy);
        var homestay = await db.Homestays.AsNoTracking().SingleAsync(x => x.Id == homestayId);
        return new BookingPolicySnapshot(null, 0, 15, 14, 14, .10m, "None", 0, true,
            [new(15, null, 100), new(7, 14, 70), new(3, 6, 50), new(0, 2, 0)],
            [new(1, 180, "NightlyPercent", 30), new(181, 360, "NightlyPercent", 50), new(361, null, "NightlyPercent", 100)])
            { Document = OperationalPolicyDocument.SunriseGardenDefault() };
    }

    public static BookingPolicySnapshot ParseSnapshot(string json)
    {
        try
        {
            var parsed = JsonSerializer.Deserialize<BookingPolicySnapshot>(json, JsonOptions);
            if (parsed is not null && parsed.HoldMinutes > 0 && parsed.CancellationTiers?.Count > 0)
                return parsed.Document is null ? parsed with { Document = OperationalPolicyDocument.SunriseGardenDefault() } : parsed;
        }
        catch (JsonException) { }
        return DefaultSnapshot();
    }
    public static string Serialize(BookingPolicySnapshot policy) => JsonSerializer.Serialize(policy, JsonOptions);
    public static BookingPolicySnapshot DefaultSnapshot() => new(null, 0, 15, 14, 14, .10m, "None", 0, true,
        [new(15, null, 100), new(7, 14, 70), new(3, 6, 50), new(0, 2, 0)],
        [new(1, 180, "NightlyPercent", 30), new(181, 360, "NightlyPercent", 50), new(361, null, "NightlyPercent", 100)])
        { Document = OperationalPolicyDocument.SunriseGardenDefault() };

    public static decimal RefundPercent(BookingPolicySnapshot policy, int daysBeforeCheckIn) => policy.CancellationTiers
        .Where(x => daysBeforeCheckIn >= x.MinimumDays && (!x.MaximumDays.HasValue || daysBeforeCheckIn <= x.MaximumDays.Value))
        .OrderByDescending(x => x.MinimumDays).Select(x => (decimal?)x.RefundPercent).FirstOrDefault() ?? 0;

    public static decimal LateCheckoutFee(BookingPolicySnapshot policy, int minutes, decimal nightlyPrice)
    {
        var tier = policy.LateCheckoutTiers.Where(x => minutes >= x.FromMinutes && (!x.ToMinutes.HasValue || minutes <= x.ToMinutes.Value)).OrderByDescending(x => x.FromMinutes).FirstOrDefault();
        if (tier is null) return 0;
        return decimal.Round(tier.CalculationType == "NightlyPercent" ? nightlyPrice * tier.Value / 100m : tier.Value, 0, MidpointRounding.AwayFromZero);
    }

    private static BookingPolicySnapshot ToSnapshot(HomestayPolicy p) => new(p.Id, p.Version, p.HoldMinutes, p.ReviewCreateDays, p.ReviewEditDays,
        p.CommissionRate, p.GuestDowngradeRefundMode, p.GuestDowngradeRefundPercent, p.AutoApproveLateCheckoutWithoutNextBooking,
        p.CancellationTiers.OrderByDescending(x => x.MinimumDays).Select(x => new CancellationTierSnapshot(x.MinimumDays, x.MaximumDays, x.RefundPercent)).ToList(),
        p.LateCheckoutTiers.OrderBy(x => x.FromMinutes).Select(x => new LateTierSnapshot(x.FromMinutes, x.ToMinutes, x.CalculationType, x.Value)).ToList())
        { Document = ParseDocument(p.OperationalPolicyJson) };

    public static OperationalPolicyDocument ParseDocument(string? json)
    {
        if (!string.IsNullOrWhiteSpace(json) && json != "{}")
        {
            try
            {
                var document = JsonSerializer.Deserialize<OperationalPolicyDocument>(json, JsonOptions);
                if (document is not null) return document;
            }
            catch (JsonException) { }
        }
        return OperationalPolicyDocument.SunriseGardenDefault();
    }
}
