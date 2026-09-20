using System.Globalization;
using System.Security.Claims;
using System.Text;
using HomestayAuth.Api.Features.Bookings;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Recommendations;

public sealed record RecommendationQuery(string? Search, DateOnly? CheckIn, DateOnly? CheckOut,
    int Guests, int Rooms, decimal? TotalBudget, string? Amenities, string? RoomType, int MinRating, int TopK, string? SessionId);
public sealed record RecommendationItem(long Id, string Name, string District, string Province,
    string? ThumbnailUrl, long RoomTypeId, string RoomTypeName, decimal EstimatedTotal,
    decimal Score, IReadOnlyList<string> Reasons);

public sealed class RecommendationService(AppDbContext db)
{
    private static string Normalize(string? value)
    {
        var source = (value ?? "").Normalize(NormalizationForm.FormD).ToLowerInvariant().Replace('đ', 'd');
        return new string(source.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray()).Trim();
    }

    public async Task<IReadOnlyList<RecommendationItem>> Recommend(RecommendationQuery query, ClaimsPrincipal user)
    {
        var homesQuery = db.Homestays.AsNoTracking().Where(h => h.Status == "Approved");
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{query.Search.Trim()}%";
            homesQuery = homesQuery.Where(h => EF.Functions.ILike(h.Name, pattern)
                || EF.Functions.ILike(h.District, pattern) || EF.Functions.ILike(h.Province, pattern));
        }
        var homes = await homesQuery.Select(h => new { h.Id, h.Name, h.District, h.Province,
            ThumbnailUrl = h.Images.OrderByDescending(i => i.IsThumbnail).ThenBy(i => i.SortOrder)
                .Select(i => i.ImageUrl).FirstOrDefault() }).ToListAsync();
        if (homes.Count == 0) return [];
        var homeIds = homes.Select(h => h.Id).ToArray();
        var types = await db.RoomTypes.AsNoTracking().Where(r => homeIds.Contains(r.HomestayId) && r.Status == "Active")
            .Select(r => new { r.Id, r.HomestayId, r.Name, r.BasePrice, r.BaseCapacity, r.MaxCapacity,
                r.ExtraGuestAllowed, r.ExtraGuestFee }).ToListAsync();
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
        var futureCheckIn = query.CheckIn > BookingRules.Today;
        var blocked = query.CheckIn.HasValue && query.CheckOut.HasValue
            ? await BookingAvailability.BlockingDetails(db, query.CheckIn.Value, query.CheckOut.Value, now)
                .Where(d => typeIds.Contains(d.RoomTypeId))
                .Select(d => new { d.RoomTypeId, d.RoomId, d.Quantity }).ToListAsync()
            : [];
        var periods = query.CheckIn.HasValue && query.CheckOut.HasValue
            ? await db.RoomPricePeriods.AsNoTracking().Where(p => typeIds.Contains(p.RoomTypeId)
                && p.StartDate < query.CheckOut.Value && p.EndDate >= query.CheckIn.Value)
                .Select(p => new { p.RoomTypeId, p.StartDate, p.EndDate, p.PricePerNight }).ToListAsync()
            : [];
        var userId = long.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var parsed) ? parsed : 0;
        var history = userId > 0
            ? await db.Bookings.AsNoTracking().Where(b => b.CustomerId == userId && homeIds.Contains(b.HomestayId)
                && new[] { "Confirmed", "CheckedIn", "Completed" }.Contains(b.Status))
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
        var nights = query.CheckIn.HasValue && query.CheckOut.HasValue
            ? query.CheckOut.Value.DayNumber - query.CheckIn.Value.DayNumber : 1;
        var results = new List<RecommendationItem>();
        foreach (var home in homes)
        {
            var homeAmenities = amenities.Where(a => a.HomestayId == home.Id).Select(a => Normalize(a.Name)).ToHashSet();
            var eligible = new List<(long Id, string Name, decimal Total)>();
            foreach (var type in types.Where(t => t.HomestayId == home.Id))
            {
                if (!string.IsNullOrWhiteSpace(query.RoomType) && !Normalize(type.Name).Contains(Normalize(query.RoomType))) continue;
                var capacity = type.ExtraGuestAllowed ? type.MaxCapacity : type.BaseCapacity;
                if (capacity * query.Rooms < query.Guests) continue;
                var occupiedIds = blocked.Where(b => b.RoomTypeId == type.Id && b.RoomId.HasValue).Select(b => b.RoomId!.Value).ToHashSet();
                var legacyCount = blocked.Where(b => b.RoomTypeId == type.Id && !b.RoomId.HasValue).Sum(b => b.Quantity);
                var available = rooms.Count(r => r.RoomTypeId == type.Id
                    && (r.Status == "Available" || (futureCheckIn && BookingRules.InventoryStatuses.Contains(r.Status)))
                    && !occupiedIds.Contains(r.Id)) - legacyCount;
                if (available < query.Rooms) continue;
                decimal perRoomStay = 0;
                if (query.CheckIn.HasValue && query.CheckOut.HasValue)
                    for (var date = query.CheckIn.Value; date < query.CheckOut.Value; date = date.AddDays(1))
                        perRoomStay += periods.Where(p => p.RoomTypeId == type.Id && p.StartDate <= date && p.EndDate >= date)
                            .OrderByDescending(p => p.StartDate).Select(p => (decimal?)p.PricePerNight).FirstOrDefault() ?? type.BasePrice;
                else perRoomStay = type.BasePrice;
                var extraGuests = Math.Max(0, query.Guests - type.BaseCapacity * query.Rooms);
                var total = perRoomStay * query.Rooms + extraGuests * type.ExtraGuestFee * nights;
                if (query.TotalBudget.HasValue && total > query.TotalBudget.Value) continue;
                eligible.Add((type.Id, type.Name, total));
            }
            if (eligible.Count == 0) continue;
            var best = eligible.OrderBy(t => t.Total).First();
            var rating = ratings.FirstOrDefault(r => r.HomestayId == home.Id);
            if (query.MinRating > 0 && (rating is null || rating.Average < query.MinRating)) continue;
            var smoothedRating = ((rating?.Average ?? 4) * (rating?.Count ?? 0) + 4d * 5) / ((rating?.Count ?? 0) + 5);
            var priceFit = query.TotalBudget.HasValue
                ? (double)(1 - Math.Abs(query.TotalBudget.Value - best.Total) / query.TotalBudget.Value)
                : (double)(1 - best.Total / 10000000m);
            var amenityFit = preferred.Length == 0 ? 0 : (double)preferred.Count(homeAmenities.Contains) / preferred.Length;
            var historyCount = history.FirstOrDefault(h => h.HomestayId == home.Id)?.Count ?? 0;
            var viewCount = recentViews.FirstOrDefault(v => v.HomestayId == home.Id)?.Count ?? 0;
            var historyFit = Math.Min(1, 0.7 * Math.Log(1 + historyCount * 3d) / Math.Log(11)
                + 0.3 * Math.Log(1 + viewCount) / Math.Log(6));
            var score = Math.Round((40 * Math.Clamp(priceFit, 0, 1) + 30 * amenityFit
                + 20 * Math.Clamp((smoothedRating - 1) / 4, 0, 1) + 10 * historyFit), 2);
            var matchingAmenities = preferred.Count(homeAmenities.Contains);
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
