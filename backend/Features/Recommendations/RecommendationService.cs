using System.Globalization;
using System.Security.Claims;
using System.Text;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Bookings;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Recommendations;

public sealed record RecommendationQuery(string? Search, string? Location, DateOnly? CheckIn, DateOnly? CheckOut,
    int Guests, int Adults, int Children, int Rooms, decimal? TotalBudget, string? Amenities, string? RoomType,
    int MinRating, int TopK, string? SessionId, int? TallChildren = null, int? SmallChildren = null);
public sealed record RecommendationItem(long Id, string Name, string District, string Province,
    string? ThumbnailUrl, long RoomTypeId, string RoomTypeName, decimal EstimatedTotal,
    decimal Score, IReadOnlyList<string> Reasons);

// Candidates are filtered with the same OccupancyRules and priced with the same BookingPricingService as
// POST /api/bookings/quote, so a recommended room can be booked and its estimate matches the quote (no voucher/deal).
public sealed class RecommendationService(AppDbContext db, RecommendationWeightsProvider weightsProvider,
    PolicyService policyService, BookingPricingService pricingService)
{
    public string ModelVersion => weightsProvider.Current.Version;
    private static string Normalize(string? value)
    {
        var source = (value ?? "").Normalize(NormalizationForm.FormD).ToLowerInvariant().Replace('đ', 'd');
        return new string(source.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray()).Trim();
    }

    public async Task<IReadOnlyList<RecommendationItem>> Recommend(RecommendationQuery query, ClaimsPrincipal user)
    {
        var weights = weightsProvider.Current;
        var homesQuery = db.Homestays.AsNoTracking().Where(h => h.Status == "Approved");
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{query.Search.Trim()}%";
            homesQuery = homesQuery.Where(h => EF.Functions.ILike(h.Name, pattern)
                || EF.Functions.ILike(h.District, pattern) || EF.Functions.ILike(h.Province, pattern));
        }
        if (!string.IsNullOrWhiteSpace(query.Location))
        {
            var locationPattern = $"%{query.Location.Trim()}%";
            homesQuery = homesQuery.Where(h => EF.Functions.ILike(h.District, locationPattern)
                || EF.Functions.ILike(h.Province, locationPattern));
        }
        var homes = await homesQuery.Select(h => new { h.Id, h.Name, h.District, h.Province,
            ThumbnailUrl = h.Images.OrderByDescending(i => i.IsThumbnail).ThenBy(i => i.SortOrder)
                .Select(i => i.ImageUrl).FirstOrDefault() }).ToListAsync();
        if (homes.Count == 0) return [];
        var homeIds = homes.Select(h => h.Id).ToArray();
        var types = await db.RoomTypes.AsNoTracking().Where(r => homeIds.Contains(r.HomestayId) && r.Status == "Active").ToListAsync();
        if (types.Count == 0) return [];
        var typeIds = types.Select(t => t.Id).ToArray();
        var rooms = await db.Rooms.AsNoTracking().Where(r => typeIds.Contains(r.RoomTypeId))
            .Select(r => new { r.Id, r.RoomTypeId, r.Status }).ToListAsync();
        var amenities = await db.HomestayAmenities.AsNoTracking().Where(a => homeIds.Contains(a.HomestayId))
            .Select(a => new { a.HomestayId, a.Amenity.Name }).ToListAsync();
        var ratings = await db.Reviews.AsNoTracking().Where(r => homeIds.Contains(r.HomestayId) && r.Status == "Visible")
            .GroupBy(r => r.HomestayId).Select(g => new { HomestayId = g.Key, Count = g.Count(), Average = g.Average(r => r.Rating) }).ToListAsync();
        var images = await db.RoomTypeImages.AsNoTracking().Where(i => typeIds.Contains(i.RoomTypeId))
            .OrderByDescending(i => i.IsThumbnail).ThenBy(i => i.SortOrder)
            .Select(i => new { i.RoomTypeId, i.ImageUrl }).ToListAsync();

        var now = DateTime.UtcNow;
        // Same as the catalog: without dates (or for a future stay) Occupied/Cleaning rooms still count.
        var futureCheckIn = !query.CheckIn.HasValue || query.CheckIn > BookingRules.Today;
        var blocked = query.CheckIn.HasValue && query.CheckOut.HasValue
            ? await BookingAvailability.BlockingDetails(db, query.CheckIn.Value, query.CheckOut.Value, now)
                .Where(d => typeIds.Contains(d.RoomTypeId))
                .Select(d => new { d.RoomTypeId, d.RoomId, d.Quantity }).ToListAsync()
            : [];
        // Without dates the estimate is one night from today, priced like a real quote would be.
        var stayStart = query.CheckIn ?? BookingRules.Today;
        var stayEnd = query.CheckOut ?? stayStart.AddDays(1);
        var periods = await db.RoomPricePeriods.AsNoTracking().Where(p => typeIds.Contains(p.RoomTypeId)
            && p.StartDate < stayEnd && p.EndDate >= stayStart).ToListAsync();
        var taxPercent = await CustomerTaxSettings.ReadPercent(db);
        var policies = new Dictionary<long, BookingPolicySnapshot>();
        var party = OccupancyRules.FromCounts(query.Adults, query.Children, query.TallChildren, query.SmallChildren, null,
            OperationalPolicyDocument.SunriseGardenDefault().Guests.AdultAge);
        var userId = long.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var parsed) ? parsed : 0;
        var history = userId > 0
            ? await db.Bookings.AsNoTracking().Where(b => b.CustomerId == userId && homeIds.Contains(b.HomestayId)
                && new[] { BookingStatus.Confirmed, BookingStatus.CheckedIn, BookingStatus.CheckoutPendingPayment, BookingStatus.CheckedOut }.Contains(b.Status))
                .GroupBy(b => b.HomestayId).Select(g => new { HomestayId = g.Key, Count = g.Count() }).ToListAsync()
            : [];
        var recentViews = !string.IsNullOrWhiteSpace(query.SessionId)
            ? await db.RecommendationEvents.AsNoTracking().Where(e => e.Source == "real" && e.EventType == "view"
                && e.SessionId == query.SessionId && e.OccurredAt >= now.AddDays(-90) && e.HomestayId.HasValue
                && homeIds.Contains(e.HomestayId.Value))
                .GroupBy(e => e.HomestayId).Select(g => new { HomestayId = g.Key, Count = g.Count() }).ToListAsync()
            : [];

        var preferred = (query.Amenities ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(Normalize).Distinct().ToArray();
        var nights = stayEnd.DayNumber - stayStart.DayNumber;
        var results = new List<RecommendationItem>();
        foreach (var home in homes)
        {
            var homeAmenities = amenities.Where(a => a.HomestayId == home.Id).Select(a => Normalize(a.Name)).ToHashSet();
            var eligible = new List<(long Id, string Name, decimal Total)>();
            foreach (var type in types.Where(t => t.HomestayId == home.Id))
            {
                if (!string.IsNullOrWhiteSpace(query.RoomType) && !Normalize(type.Name).Contains(Normalize(query.RoomType))) continue;
                if (!OccupancyRules.Evaluate(party, query.Rooms, type.BaseCapacity, type.MaxCapacity, type.ExtraGuestAllowed, type.MaxExtraChildren).Ok)
                    continue;
                var occupiedIds = blocked.Where(b => b.RoomTypeId == type.Id && b.RoomId.HasValue).Select(b => b.RoomId!.Value).ToHashSet();
                var legacyCount = blocked.Where(b => b.RoomTypeId == type.Id && !b.RoomId.HasValue).Sum(b => b.Quantity);
                var available = rooms.Count(r => r.RoomTypeId == type.Id
                    && (r.Status == "Available" || (futureCheckIn && BookingRules.InventoryStatuses.Contains(r.Status)))
                    && !occupiedIds.Contains(r.Id)) - legacyCount;
                if (available < query.Rooms) continue;
                if (!policies.TryGetValue(home.Id, out var policy))
                    policies[home.Id] = policy = await policyService.Resolve(home.Id, now);
                var price = pricingService.Calculate(type, stayStart, stayEnd, query.Adults, query.Children, query.Rooms, null, null,
                    periods.Where(p => p.RoomTypeId == type.Id).ToList(), policy, BookingRules.Today, party: party);
                var total = price.TotalAmount + CustomerTaxSettings.Amount(price.TotalAmount, taxPercent);
                if (query.TotalBudget.HasValue && total > query.TotalBudget.Value) continue;
                eligible.Add((type.Id, type.Name, total));
            }
            if (eligible.Count == 0) continue;
            var best = eligible.OrderBy(t => t.Total).First();
            var rating = ratings.FirstOrDefault(r => r.HomestayId == home.Id);
            if (query.MinRating > 0 && (rating is null || rating.Average < query.MinRating)) continue;
            var matchingAmenities = preferred.Count(homeAmenities.Contains);
            var score = RecommendationScoring.Score(weights, new ScoringInput(query.TotalBudget, best.Total, preferred.Length,
                matchingAmenities, rating?.Average, rating?.Count ?? 0,
                history.FirstOrDefault(h => h.HomestayId == home.Id)?.Count ?? 0,
                recentViews.FirstOrDefault(v => v.HomestayId == home.Id)?.Count ?? 0));
            var reasons = new List<string> { $"{query.Rooms} × {best.Name} đủ cho {query.Guests} khách",
                $"Khoảng {best.Total:N0}đ cho {nights} đêm" };
            if (matchingAmenities > 0) reasons.Add($"Có {matchingAmenities} tiện nghi bạn chọn");
            results.Add(new RecommendationItem(home.Id, home.Name, home.District, home.Province,
                home.ThumbnailUrl ?? images.FirstOrDefault(i => i.RoomTypeId == best.Id)?.ImageUrl,
                best.Id, best.Name, best.Total, (decimal)score, reasons));
        }
        return results.OrderByDescending(r => r.Score).ThenBy(r => r.EstimatedTotal).ThenBy(r => r.Id)
            .Take(query.TopK).ToList();
    }
}
