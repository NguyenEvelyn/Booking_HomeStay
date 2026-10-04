using System.Security.Claims;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using HomestayAuth.Api.Features.Bookings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;
using HomestayAuth.Api.Features.Admin.Authorization;

namespace HomestayAuth.Api.Features.Recommendations;

public sealed record RecommendationEventRequest(string SessionId, string EventType, long? HomestayId,
    string? Search, string? Location, DateOnly? CheckIn, DateOnly? CheckOut, int? Guests, int? Adults, int? Children, int? Rooms,
    decimal? TotalBudget, string[]? Amenities, long[]? RecommendedIds);

[ApiController]
[Route("api/recommendation-events")]
public sealed class RecommendationEventsController(AppDbContext db, RecommendationWeightsProvider weightsProvider) : ControllerBase
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
            || request.Adults is < 1 or > 30 || request.Children is < 0 or > 20
            || (request.EventType == "search" && request.Adults.HasValue && request.Children.HasValue
                && request.Adults.Value + request.Children.Value != request.Guests)
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
                search = request.Search?.Trim(), location = request.Location?.Trim(), request.CheckIn, request.CheckOut,
                request.Guests, request.Adults, request.Children, request.Rooms,
                request.TotalBudget, amenities = request.Amenities?.Take(20),
                recommendedIds = request.RecommendedIds?.Take(10)
            }),
            Source = "real"
        });
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Policy = AdminPolicies.Access)]
    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] int days = 30)
    {
        days = Math.Clamp(days, 1, 365);
        var since = DateTime.UtcNow.AddDays(-days);
        const int attributionDays = 7;
        var events = await db.RecommendationEvents.AsNoTracking()
            .Where(e => e.Source == "real" && e.OccurredAt >= since)
            .Select(e => new { e.SessionId, e.EventType, e.HomestayId, e.BookingId, e.CustomerId, e.QueryData, e.OccurredAt }).ToListAsync();
        var searches = events.Where(e => e.EventType == "search").ToList();
        var views = events.Where(e => e.EventType == "view").ToList();
        var bookings = events.Where(e => e.EventType == "booking").ToList();
        var confirmedBookings = await db.Bookings.AsNoTracking().CountAsync(b => b.CreatedAt >= since
            && new[] { BookingStatus.Confirmed, BookingStatus.CheckedIn, BookingStatus.CheckoutPendingPayment, BookingStatus.CheckedOut }.Contains(b.Status));
        var linkedBookingIds = bookings.Where(e => e.BookingId.HasValue).Select(e => e.BookingId!.Value).Distinct().Count();
        var invalidSearchPayloads = 0;
        var recommendedSearches = 0;
        var searchesWithRecommendationView = 0;
        var searchesWithBooking = 0;
        var searchesWithRecommendedBooking = 0;
        var reciprocalDiscountedGain = 0d;
        foreach (var search in searches)
        {
            long[] recommendedIds;
            try
            {
                using var data = JsonDocument.Parse(search.QueryData);
                if (!data.RootElement.TryGetProperty("recommendedIds", out var ids) || ids.ValueKind != JsonValueKind.Array) continue;
                recommendedIds = ids.EnumerateArray().Select(id => id.TryGetInt64(out var value) ? value : 0)
                    .Where(id => id > 0).Take(5).ToArray();
            }
            catch (JsonException) { invalidSearchPayloads++; continue; }
            if (recommendedIds.Length == 0) continue;
            recommendedSearches++;
            if (recommendedIds.Any(homeId => views.Any(view => view.SessionId == search.SessionId && view.HomestayId == homeId
                    && view.OccurredAt >= search.OccurredAt && view.OccurredAt <= search.OccurredAt.AddHours(24))))
                searchesWithRecommendationView++;
            var attributedBooking = bookings.Where(booking => booking.SessionId == search.SessionId
                    && booking.OccurredAt >= search.OccurredAt
                    && booking.OccurredAt <= search.OccurredAt.AddDays(attributionDays)
                    && !searches.Any(laterSearch => laterSearch.SessionId == search.SessionId
                        && laterSearch.OccurredAt > search.OccurredAt && laterSearch.OccurredAt <= booking.OccurredAt))
                .OrderBy(booking => booking.OccurredAt).FirstOrDefault();
            if (attributedBooking is null) continue;
            searchesWithBooking++;
            var rank = Array.IndexOf(recommendedIds, attributedBooking.HomestayId ?? 0);
            if (rank < 0) continue;
            searchesWithRecommendedBooking++;
            reciprocalDiscountedGain += 1d / Math.Log2(rank + 2);
        }
        var weights = weightsProvider.Current;
        return Ok(new { days, attributionDays, modelVersion = weights.Version, modelIsLearned = weights.IsLearned,
            trainingMinimum = 100, attributedBookingSamples = searchesWithBooking,
            searches = searches.Count, views = views.Count,
            confirmedBookings = bookings.Count,
            uniqueSessions = events.Select(e => e.SessionId).Distinct().Count(), recommendedSearches,
            searchesWithRecommendationView,
            recommendationViewRate = recommendedSearches == 0 ? 0 : Math.Round(100d * searchesWithRecommendationView / recommendedSearches, 2),
            searchesWithBooking, searchesWithRecommendedBooking,
            bookingConversionRate = recommendedSearches == 0 ? 0 : Math.Round(100d * searchesWithBooking / recommendedSearches, 2),
            recallAt5 = searchesWithBooking == 0 ? 0 : Math.Round(100d * searchesWithRecommendedBooking / searchesWithBooking, 2),
            ndcgAt5 = searchesWithBooking == 0 ? 0 : Math.Round(100d * reciprocalDiscountedGain / searchesWithBooking, 2),
            dataQuality = new {
                confirmedBookingsInDatabase = confirmedBookings,
                linkedConfirmedBookings = linkedBookingIds,
                bookingLinkageRate = confirmedBookings == 0 ? 0 : Math.Round(100d * linkedBookingIds / confirmedBookings, 2),
                invalidSearchPayloads,
                anonymousSearches = events.Count(e => e.EventType == "search" && e.CustomerId == null),
                bookingsWithoutPriorSearch = bookings.Count(booking => !searches.Any(search => search.SessionId == booking.SessionId
                    && search.OccurredAt <= booking.OccurredAt && search.OccurredAt >= booking.OccurredAt.AddDays(-attributionDays)))
            }
        });
    }

    [Authorize(Policy = AdminPolicies.Access)]
    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] int days = 365)
    {
        days = Math.Clamp(days, 1, 730);
        var since = DateTime.UtcNow.AddDays(-days);
        var events = await db.RecommendationEvents.AsNoTracking()
            .Where(e => e.Source == "real" && e.OccurredAt >= since)
            .OrderBy(e => e.OccurredAt).ThenBy(e => e.Id)
            .Select(e => new { id = e.Id, occurredAt = e.OccurredAt, customerId = e.CustomerId,
                sessionId = e.SessionId, eventType = e.EventType, homestayId = e.HomestayId,
                bookingId = e.BookingId, queryData = e.QueryData, source = e.Source })
            .ToListAsync();
        return Ok(new { generatedAt = DateTime.UtcNow, days, source = "real", events });
    }
}
