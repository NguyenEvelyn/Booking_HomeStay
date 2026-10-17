using System.Text.Json;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public static class CustomerTaxSettings
{
    public const decimal DefaultPercent = 5m;

    public static async Task<decimal> ReadPercent(AppDbContext db, CancellationToken cancellationToken = default)
    {
        var json = await db.SystemSettings.AsNoTracking()
            .Where(x => x.Key == "platform")
            .Select(x => x.ValueJson)
            .SingleOrDefaultAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(json)) return DefaultPercent;

        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.TryGetProperty("payment", out var payment)
                && payment.TryGetProperty("customerTaxPercent", out var value)
                && value.TryGetDecimal(out var percent))
                return Math.Clamp(percent, 0m, 100m);
        }
        catch (JsonException) { }

        return DefaultPercent;
    }

    public static decimal Amount(decimal taxableAmount, decimal percent) =>
        Math.Round(Math.Max(0, taxableAmount) * Math.Clamp(percent, 0m, 100m) / 100m, 0, MidpointRounding.AwayFromZero);
}
