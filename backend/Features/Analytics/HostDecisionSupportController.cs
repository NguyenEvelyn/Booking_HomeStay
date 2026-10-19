using System.Security.Claims;
using System.Text.Json;
using HomestayAuth.Api.Features.Bookings;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Analytics;

[ApiController]
[Route("api/host/analytics/decision-support")]
[Authorize(Roles = "Host")]
public sealed class HostDecisionSupportController(AppDbContext db) : ControllerBase
{
    private sealed record OccupancyItem(int Days, int SoldRoomNights, int AvailableRoomNights, decimal Rate);
    private sealed record PickupItem(DateTime CreatedAt, decimal TotalAmount);
    private sealed record SearchDemand(string Location, DateOnly? CheckIn, DateOnly? CheckOut, int Guests, int Rooms,
        decimal? TotalBudget, string[] Amenities, long[] RecommendedIds);
    private static readonly string[] OccupiedStatuses =
        [BookingStatus.Confirmed, BookingStatus.CheckedIn, BookingStatus.CheckoutPendingPayment, BookingStatus.CheckedOut];

    private long HostId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now.AddHours(7));
        var periodStart = now.AddDays(-30);
        var previousStart = now.AddDays(-60);

        var homestayIds = await db.Homestays.AsNoTracking()
            .Where(x => x.HostId == HostId)
            .Select(x => x.Id)
            .ToArrayAsync();

        var activeRooms = await db.Rooms.AsNoTracking().CountAsync(x =>
            homestayIds.Contains(x.RoomType.HomestayId) &&
            x.RoomType.Status == "Active" &&
            x.Status != "Inactive" && x.Status != "Maintenance");

        var occupiedToday = await db.BookingDetails.AsNoTracking()
            .Where(x => homestayIds.Contains(x.Booking.HomestayId) && OccupiedStatuses.Contains(x.Booking.Status) &&
                        x.Booking.CheckInDate <= today && x.Booking.CheckOutDate > today)
            .SumAsync(x => (int?)x.Quantity) ?? 0;

        var futureBookings = await db.Bookings.AsNoTracking()
            .Where(x => homestayIds.Contains(x.HomestayId) && OccupiedStatuses.Contains(x.Status) &&
                        x.CheckInDate < today.AddDays(30) && x.CheckOutDate > today)
            .Select(x => new
            {
                x.CheckInDate,
                x.CheckOutDate,
                Quantity = x.Details.Sum(d => d.Quantity)
            }).ToListAsync();

        OccupancyItem OccupancyWindow(int days)
        {
            var end = today.AddDays(days);
            var soldRoomNights = futureBookings.Sum(x =>
                Math.Max(0, Math.Min(x.CheckOutDate.DayNumber, end.DayNumber) -
                            Math.Max(x.CheckInDate.DayNumber, today.DayNumber)) * x.Quantity);
            var capacity = activeRooms * days;
            return new OccupancyItem(days, soldRoomNights, Math.Max(0, capacity - soldRoomNights),
                capacity == 0 ? 0 : Math.Round(100m * soldRoomNights / capacity, 1));
        }

        var pickupBookings = await db.Bookings.AsNoTracking()
            .Where(x => homestayIds.Contains(x.HomestayId) && x.CreatedAt >= now.AddDays(-7) &&
                        x.CheckInDate >= today && x.Status != BookingStatus.Cancelled)
            .Select(x => new PickupItem(x.CreatedAt, x.TotalAmount))
            .ToListAsync();

        var periodBookings = await db.Bookings.AsNoTracking()
            .Where(x => homestayIds.Contains(x.HomestayId) && x.CreatedAt >= previousStart)
            .Select(x => new { x.Id, x.CustomerId, x.Status, x.CreatedAt, x.CheckInDate, x.CheckOutDate })
            .ToListAsync();
        var currentBookings = periodBookings.Where(x => x.CreatedAt >= periodStart).ToList();
        var previousBookings = periodBookings.Where(x => x.CreatedAt < periodStart).ToList();

        var cancellations = await db.Cancellations.AsNoTracking()
            .Where(x => x.CancelledAt >= periodStart &&
                        db.Bookings.Any(b => b.Id == x.BookingId && homestayIds.Contains(b.HomestayId)))
            .Select(x => new { x.Reason, x.RefundAmount, x.CancellationFee, x.PaidAmountAtCancellation })
            .ToListAsync();
        var cancellationCount = currentBookings.Count(x => x.Status == BookingStatus.Cancelled);
        var cancellationRate = currentBookings.Count == 0 ? 0 : Math.Round(100m * cancellationCount / currentBookings.Count, 1);
        var previousCancellationRate = previousBookings.Count == 0 ? 0 :
            Math.Round(100m * previousBookings.Count(x => x.Status == BookingStatus.Cancelled) / previousBookings.Count, 1);

        var events = await db.RecommendationEvents.AsNoTracking()
            .Where(x => x.Source == "real" && x.OccurredAt >= periodStart &&
                        (x.EventType == "search" ||
                         (x.HomestayId.HasValue && homestayIds.Contains(x.HomestayId.Value))))
            .Select(x => new { x.EventType, x.HomestayId, x.QueryData })
            .ToListAsync();
        var impressions = events.Count(x => x.EventType == "search" && RecommendedHostProperty(x.QueryData, homestayIds));
        var views = events.Count(x => x.EventType == "view" && x.HomestayId.HasValue && homestayIds.Contains(x.HomestayId.Value));
        var recommendationBookings = events.Count(x => x.EventType == "booking" && x.HomestayId.HasValue && homestayIds.Contains(x.HomestayId.Value));
        var hostProperties = await db.Homestays.AsNoTracking().Where(x => homestayIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name, x.District, x.Province, MinPrice = x.RoomTypes.Where(r => r.Status == "Active").Min(r => (decimal?)r.BasePrice) ?? 0 })
            .ToListAsync();
        var homestayNames = hostProperties.ToDictionary(x => x.Id, x => x.Name);
        var rankedAppearances = events.Where(x => x.EventType == "search")
            .SelectMany(x => RecommendedRanks(x.QueryData))
            .Where(x => homestayIds.Contains(x.HomestayId))
            .GroupBy(x => x.HomestayId)
            .Select(g => new
            {
                homestayId = g.Key,
                name = homestayNames.GetValueOrDefault(g.Key, "Homestay"),
                appearances = g.Count(),
                top3Appearances = g.Count(x => x.Rank <= 3),
                averageRank = Math.Round(g.Average(x => x.Rank), 1),
                views = events.Count(x => x.EventType == "view" && x.HomestayId == g.Key),
                bookings = events.Count(x => x.EventType == "booking" && x.HomestayId == g.Key)
            }).OrderByDescending(x => x.appearances).ThenBy(x => x.averageRank).ToList();

        var validCustomerBookings = await db.Bookings.AsNoTracking()
            .Where(x => homestayIds.Contains(x.HomestayId) && x.CreatedAt >= periodStart &&
                        OccupiedStatuses.Contains(x.Status))
            .GroupBy(x => x.CustomerId)
            .Select(g => new { Count = g.Count() })
            .ToListAsync();
        var repeatGuests = validCustomerBookings.Count(x => x.Count > 1);
        var repeatRate = validCustomerBookings.Count == 0 ? 0 : Math.Round(100m * repeatGuests / validCustomerBookings.Count, 1);

        var searchDemands = events.Where(x => x.EventType == "search").Select(x => ParseDemand(x.QueryData)).Where(x => x is not null).Cast<SearchDemand>().ToList();
        var relevantDemands = searchDemands.Where(d => hostProperties.Any(h => IsRelevant(d, h.District, h.Province, h.Id))).ToList();
        var budgets = relevantDemands.Where(x => x.TotalBudget.HasValue).Select(x => x.TotalBudget!.Value).OrderBy(x => x).ToList();
        var medianBudget = budgets.Count == 0 ? 0 : budgets[budgets.Count / 2];
        var topAmenities = relevantDemands.SelectMany(x => x.Amenities).Where(x => !string.IsNullOrWhiteSpace(x))
            .GroupBy(x => x.Trim(), StringComparer.OrdinalIgnoreCase).Select(g => new { name = g.Key, searches = g.Count() })
            .OrderByDescending(x => x.searches).Take(5).ToList();
        var opportunityProperties = hostProperties.Select(h =>
        {
            var demand = relevantDemands.Where(d => LocationMatches(d.Location, h.District, h.Province)).ToList();
            var missingTopK = demand.Count(d => !d.RecommendedIds.Contains(h.Id));
            var suggestedAction = medianBudget > 0 && h.MinPrice > medianBudget
                ? $"Giá từ {h.MinPrice:N0}đ đang cao hơn ngân sách giữa {medianBudget:N0}đ"
                : missingTopK > 0 ? "Rà soát ảnh, tiện nghi và chính sách để tăng điểm Top-K" : "Duy trì chất lượng và khả năng mở bán";
            return new { homestayId = h.Id, h.Name, matchedSearches = demand.Count, missedTopKSearches = missingTopK, h.MinPrice, suggestedAction };
        }).OrderByDescending(x => x.missedTopKSearches).ThenByDescending(x => x.matchedSearches).Take(5).ToList();

        var pendingPayments = await db.Bookings.CountAsync(x => homestayIds.Contains(x.HomestayId) &&
            (x.Status == BookingStatus.Hold || x.Status == BookingStatus.CheckoutPendingPayment));
        var unansweredReviews = await db.Reviews.CountAsync(x => homestayIds.Contains(x.HomestayId) &&
            x.Status == "Visible" && string.IsNullOrEmpty(x.HostReply));
        var maintenanceRooms = await db.Rooms.CountAsync(x => homestayIds.Contains(x.RoomType.HomestayId) && x.Status == "Maintenance");

        var occupancy14 = OccupancyWindow(14);
        var alerts = new List<object>();
        if (activeRooms == 0) alerts.Add(Alert("danger", "Chưa có phòng sẵn sàng bán", "Kiểm tra trạng thái phòng và mở bán phòng hoạt động.", "homestays"));
        else if (occupancy14.Rate < 35) alerts.Add(Alert("warning", "Công suất 14 ngày tới thấp", $"Mới lấp đầy {occupancy14.Rate}%. Cân nhắc điều chỉnh giá hoặc tạo ưu đãi.", "forecast"));
        if (cancellationRate >= 15 || cancellationRate > previousCancellationRate + 5)
            alerts.Add(Alert("danger", "Tỷ lệ hủy đang tăng", $"Tỷ lệ hủy 30 ngày là {cancellationRate}%, kỳ trước {previousCancellationRate}%.", "bookings"));
        if (pendingPayments > 0) alerts.Add(Alert("warning", "Có đơn cần xử lý thanh toán", $"{pendingPayments} đơn đang chờ thanh toán hoặc hoàn tất công nợ.", "bookings"));
        if (unansweredReviews > 0) alerts.Add(Alert("info", "Đánh giá chưa phản hồi", $"{unansweredReviews} đánh giá đang chờ bạn phản hồi.", "reviews"));
        if (maintenanceRooms > 0) alerts.Add(Alert("info", "Phòng đang bảo trì", $"{maintenanceRooms} phòng chưa tham gia công suất bán.", "homestays"));
        if (views >= 10 && recommendationBookings * 100m / views < 5)
            alerts.Add(Alert("warning", "Nhiều lượt xem nhưng ít booking", "Nên rà lại ảnh, giá và chính sách của homestay.", "homestays"));

        return Ok(new
        {
            generatedAt = now,
            inventoryNow = new
            {
                totalSellableRooms = activeRooms,
                occupiedRooms = Math.Min(activeRooms, occupiedToday),
                availableRooms = Math.Max(0, activeRooms - occupiedToday),
                occupancyRate = activeRooms == 0 ? 0 : Math.Round(100m * Math.Min(activeRooms, occupiedToday) / activeRooms, 1)
            },
            futureOccupancy = new[] { OccupancyWindow(7), occupancy14, OccupancyWindow(30) },
            pickup = new
            {
                last24Hours = Pickup(pickupBookings, now.AddDays(-1)),
                last3Days = Pickup(pickupBookings, now.AddDays(-3)),
                last7Days = Pickup(pickupBookings, now.AddDays(-7))
            },
            funnel = new
            {
                impressions,
                views,
                bookings = recommendationBookings,
                impressionToViewRate = impressions == 0 ? 0 : Math.Round(100m * views / impressions, 1),
                viewToBookingRate = views == 0 ? 0 : Math.Round(100m * recommendationBookings / views, 1),
                topKProperties = rankedAppearances.Take(5)
            },
            cancellations = new
            {
                count = cancellationCount,
                rate = cancellationRate,
                previousRate = previousCancellationRate,
                refunded = cancellations.Sum(x => x.RefundAmount),
                retainedFees = cancellations.Sum(x => x.CancellationFee),
                lostRevenue = cancellations.Sum(x => Math.Max(0, x.PaidAmountAtCancellation - x.CancellationFee)),
                topReasons = cancellations.GroupBy(x => string.IsNullOrWhiteSpace(x.Reason) ? "Không nêu lý do" : x.Reason.Trim())
                    .Select(g => new { reason = g.Key, count = g.Count() }).OrderByDescending(x => x.count).Take(3)
            },
            customers = new { uniqueGuests = validCustomerBookings.Count, repeatGuests, repeatRate },
            demandOpportunity = new
            {
                relevantSearches = relevantDemands.Count,
                searchesWithoutResults = relevantDemands.Count(x => x.RecommendedIds.Length == 0),
                medianBudget,
                averageGuests = relevantDemands.Count == 0 ? 0 : Math.Round(relevantDemands.Average(x => x.Guests), 1),
                requestedRoomNights = relevantDemands.Sum(x => x.CheckIn.HasValue && x.CheckOut.HasValue
                    ? Math.Max(0, x.CheckOut.Value.DayNumber - x.CheckIn.Value.DayNumber) * Math.Max(1, x.Rooms) : 0),
                topAmenities,
                properties = opportunityProperties
            },
            alerts
        });
    }

    private static object Pickup(IEnumerable<PickupItem> bookings, DateTime since)
    {
        var selected = bookings.Where(x => x.CreatedAt >= since).ToList();
        return new { bookings = selected.Count, value = selected.Sum(x => x.TotalAmount) };
    }

    private static object Alert(string severity, string title, string message, string target) =>
        new { severity, title, message, target };

    private static bool RecommendedHostProperty(string queryData, long[] homestayIds)
    {
        try
        {
            using var json = JsonDocument.Parse(queryData);
            if (!json.RootElement.TryGetProperty("recommendedIds", out var ids) || ids.ValueKind != JsonValueKind.Array) return false;
            return ids.EnumerateArray().Any(x => x.TryGetInt64(out var id) && homestayIds.Contains(id));
        }
        catch (JsonException) { return false; }
    }

    private static IEnumerable<(long HomestayId, int Rank)> RecommendedRanks(string queryData)
    {
        try
        {
            using var json = JsonDocument.Parse(queryData);
            if (!json.RootElement.TryGetProperty("recommendedIds", out var ids) || ids.ValueKind != JsonValueKind.Array) return [];
            return ids.EnumerateArray().Select((x, index) => (Valid: x.TryGetInt64(out var id), Id: id, Rank: index + 1))
                .Where(x => x.Valid).Select(x => (x.Id, x.Rank)).ToArray();
        }
        catch (JsonException) { return []; }
    }

    private static SearchDemand? ParseDemand(string queryData)
    {
        try
        {
            using var json = JsonDocument.Parse(queryData);
            var root = json.RootElement;
            static DateOnly? Date(JsonElement root, string name) => root.TryGetProperty(name, out var x) && x.ValueKind == JsonValueKind.String && DateOnly.TryParse(x.GetString(), out var value) ? value : null;
            static int Int(JsonElement root, string name, int fallback) => root.TryGetProperty(name, out var x) && x.TryGetInt32(out var value) ? value : fallback;
            var location = root.TryGetProperty("location", out var loc) && loc.ValueKind == JsonValueKind.String ? loc.GetString() ?? "" : "";
            decimal? budget = root.TryGetProperty("totalBudget", out var b) && b.TryGetDecimal(out var amount) ? amount : null;
            var amenities = root.TryGetProperty("amenities", out var a) && a.ValueKind == JsonValueKind.Array
                ? a.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString() ?? "").ToArray() : [];
            var ids = root.TryGetProperty("recommendedIds", out var r) && r.ValueKind == JsonValueKind.Array
                ? r.EnumerateArray().Where(x => x.TryGetInt64(out _)).Select(x => x.GetInt64()).ToArray() : [];
            return new SearchDemand(location, Date(root, "checkIn"), Date(root, "checkOut"), Int(root, "guests", 1), Int(root, "rooms", 1), budget, amenities, ids);
        }
        catch (JsonException) { return null; }
    }

    private static bool IsRelevant(SearchDemand demand, string district, string province, long homestayId) =>
        demand.RecommendedIds.Contains(homestayId) || LocationMatches(demand.Location, district, province);

    private static bool LocationMatches(string location, string district, string province)
    {
        if (string.IsNullOrWhiteSpace(location)) return true;
        var value = location.Trim().ToLowerInvariant();
        return district.ToLowerInvariant().Contains(value) || province.ToLowerInvariant().Contains(value) ||
               value.Contains(district.ToLowerInvariant()) || value.Contains(province.ToLowerInvariant());
    }
}
