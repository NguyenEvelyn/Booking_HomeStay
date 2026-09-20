using System.Security.Claims;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;

namespace HomestayAuth.Api.Features.Recommendations;

public sealed record RecommendationEventRequest(string SessionId, string EventType, long? HomestayId,
    string? Search, DateOnly? CheckIn, DateOnly? CheckOut, int? Guests, int? Rooms,
    decimal? TotalBudget, string[]? Amenities, long[]? RecommendedIds);

[ApiController]
[Route("api/recommendation-events")]
public sealed class RecommendationEventsController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    [EnableRateLimiting("recommendation-events")]
    public async Task<IActionResult> Record([FromBody] RecommendationEventRequest request)
    {
        if (request.SessionId.Length is < 16 or > 100 || !Guid.TryParse(request.SessionId, out _)
            || request.EventType is not ("search" or "view")
            || (request.EventType == "view" && request.HomestayId is null)
            || (request.EventType == "search" && request.HomestayId is not null)
            || request.Search?.Length > 200 || request.Amenities?.Length > 20
            || request.RecommendedIds?.Length > 10 || request.Guests is < 1 or > 30
            || request.Rooms is < 1 or > 10 || request.TotalBudget is <= 0 or > 1000000000)
            return BadRequest(new { message = "Dữ liệu sự kiện không hợp lệ." });

        if (request.HomestayId.HasValue && !await db.Homestays.AnyAsync(h => h.Id == request.HomestayId && h.Status == "Approved"))
            return NotFound(new { message = "Không tìm thấy homestay." });

        var customerId = long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : (long?)null;
        db.RecommendationEvents.Add(new RecommendationEvent
        {
            OccurredAt = DateTime.UtcNow,
            CustomerId = customerId,
            SessionId = request.SessionId,
            EventType = request.EventType,
            HomestayId = request.HomestayId,
            QueryData = JsonSerializer.Serialize(new
            {
                search = request.Search?.Trim(), request.CheckIn, request.CheckOut, request.Guests, request.Rooms,
                request.TotalBudget, amenities = request.Amenities?.Take(20),
                recommendedIds = request.RecommendedIds?.Take(10)
            }),
            Source = "real"
        });
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] int days = 30)
    {
        days = Math.Clamp(days, 1, 365);
        var since = DateTime.UtcNow.AddDays(-days);
        var events = await db.RecommendationEvents.AsNoTracking()
            .Where(e => e.Source == "real" && e.OccurredAt >= since)
            .Select(e => new { e.SessionId, e.EventType, e.HomestayId, e.QueryData, e.OccurredAt }).ToListAsync();
        var searches = events.Where(e => e.EventType == "search").ToList();
        var views = events.Where(e => e.EventType == "view").ToList();
        var recommendedSearches = 0;
        var searchesWithRecommendationView = 0;
        foreach (var search in searches)
        {
            using var data = JsonDocument.Parse(search.QueryData);
            if (!data.RootElement.TryGetProperty("recommendedIds", out var ids) || ids.ValueKind != JsonValueKind.Array || ids.GetArrayLength() == 0) continue;
            recommendedSearches++;
            if (ids.EnumerateArray().Any(id => id.TryGetInt64(out var homeId)
                && views.Any(view => view.SessionId == search.SessionId && view.HomestayId == homeId
                    && view.OccurredAt >= search.OccurredAt && view.OccurredAt <= search.OccurredAt.AddHours(24))))
                searchesWithRecommendationView++;
        }
        return Ok(new { days, searches = searches.Count, views = views.Count,
            uniqueSessions = events.Select(e => e.SessionId).Distinct().Count(), recommendedSearches,
            searchesWithRecommendationView,
            recommendationViewRate = recommendedSearches == 0 ? 0 : Math.Round(100d * searchesWithRecommendationView / recommendedSearches, 2) });
    }
}
