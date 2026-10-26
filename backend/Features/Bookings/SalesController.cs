using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

// Rooms currently on sale, for the home page sale popup: live last-minute deals plus price periods below the
// room type's list price. Prices come from BookingPricingService.Night, so they match the calendar and the quote.
[ApiController, Route("api/sales")]
public sealed class SalesController(AppDbContext db, DealService deals, PolicyService policies) : ControllerBase
{
    [AllowAnonymous, HttpGet]
    public async Task<IActionResult> Active([FromQuery] string? province, [FromQuery] int limit = 8, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 20);
        var now = DateTime.UtcNow; var today = BookingRules.Today;
        var dealRows = await db.RoomDeals.AsNoTracking()
            .Where(x => x.Status == RoomDealStatus.Active && x.SaleEndsAt > now && x.EndDate > today
                && x.Homestay.Status == "Approved" && x.RoomType.Status == "Active"
                && (string.IsNullOrWhiteSpace(province) || x.Homestay.Province == province.Trim()))
            .OrderBy(x => x.SaleEndsAt).ThenByDescending(x => x.DiscountPercent).Take(limit * 2)
            .Select(x => new { Deal = x, x.RoomType }).ToListAsync(ct);
        var periodRows = await db.RoomPricePeriods.AsNoTracking()
            .Where(p => p.EndDate >= today && p.PricePerNight < p.RoomType.BasePrice
                && p.RoomType.Status == "Active" && p.RoomType.Homestay.Status == "Approved"
                && p.RoomType.Rooms.Any(r => BookingRules.InventoryStatuses.Contains(r.Status))
                && (string.IsNullOrWhiteSpace(province) || p.RoomType.Homestay.Province == province.Trim()))
            .OrderBy(p => p.PricePerNight / p.RoomType.BasePrice).Take(limit * 2)
            .Select(p => new { Period = p, p.RoomType }).ToListAsync(ct);

        var homestayIds = dealRows.Select(x => x.RoomType.HomestayId).Concat(periodRows.Select(x => x.RoomType.HomestayId)).Distinct().ToList();
        var homestays = await db.Homestays.AsNoTracking().Where(h => homestayIds.Contains(h.Id))
            .Select(h => new { h.Id, h.Name, h.Province, h.District,
                Image = h.Images.OrderByDescending(i => i.IsThumbnail).ThenBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault() })
            .ToDictionaryAsync(h => h.Id, ct);
        var roomTypeIds = dealRows.Select(x => x.RoomType.Id).Concat(periodRows.Select(x => x.RoomType.Id)).Distinct().ToList();
        var allPeriods = await db.RoomPricePeriods.AsNoTracking().Where(p => roomTypeIds.Contains(p.RoomTypeId) && p.EndDate >= today).ToListAsync(ct);
        var documents = new Dictionary<long, OperationalPolicyDocument>();
        async Task<OperationalPolicyDocument> DocumentOf(long homestayId)
        {
            if (!documents.TryGetValue(homestayId, out var document))
                documents[homestayId] = document = (await policies.Resolve(homestayId, now)).Document ?? OperationalPolicyDocument.SunriseGardenDefault();
            return document;
        }

        var items = new List<object>();
        foreach (var row in dealRows)
        {
            var deal = row.Deal;
            var remaining = deal.RoomsLimit - await deals.SoldRooms(deal.Id, now, cancellationToken: ct);
            if (remaining <= 0 || !homestays.TryGetValue(row.RoomType.HomestayId, out var home)) continue;
            var from = deal.StartDate < today ? today : deal.StartDate;
            // The deal discounts the normal price of that night (price periods and surcharges included), like the quote.
            var original = BookingPricingService.Night(row.RoomType, from, allPeriods.Where(p => p.RoomTypeId == row.RoomType.Id).ToList(), await DocumentOf(home.Id)).FinalPrice;
            var sale = DealRules.EstimatedNightlyPrice(original, deal.DiscountPercent);
            items.Add(new { kind = "Deal", key = $"deal-{deal.Id}", homestayId = home.Id, homestayName = home.Name, home.Province, home.District, image = home.Image,
                roomTypeId = row.RoomType.Id, roomTypeName = row.RoomType.Name, label = "Deal phút chót", originalPrice = original, salePrice = sale,
                discountPercent = deal.DiscountPercent, checkIn = from, checkOut = from.AddDays(1), lastNight = deal.EndDate.AddDays(-1),
                saleEndsAt = (DateTime?)deal.SaleEndsAt, remainingRooms = (int?)remaining, nonRefundable = true });
        }
        foreach (var row in periodRows)
        {
            if (!homestays.TryGetValue(row.RoomType.HomestayId, out var home)) continue;
            var from = row.Period.StartDate < today ? today : row.Period.StartDate;
            var document = await DocumentOf(home.Id);
            var sale = BookingPricingService.Night(row.RoomType, from, allPeriods.Where(p => p.RoomTypeId == row.RoomType.Id).ToList(), document).FinalPrice;
            var original = BookingPricingService.Night(row.RoomType, from, [], document).FinalPrice;
            // A newer overlapping period may override this one; only show a real reduction against the list price.
            if (sale >= original) continue;
            items.Add(new { kind = "PriceDrop", key = $"period-{row.Period.Id}", homestayId = home.Id, homestayName = home.Name, home.Province, home.District, image = home.Image,
                roomTypeId = row.RoomType.Id, roomTypeName = row.RoomType.Name, label = row.Period.Name, originalPrice = original, salePrice = sale,
                discountPercent = decimal.Round((original - sale) * 100m / original, 0, MidpointRounding.AwayFromZero),
                checkIn = from, checkOut = from.AddDays(1), lastNight = row.Period.EndDate,
                saleEndsAt = (DateTime?)null, remainingRooms = (int?)null, nonRefundable = false });
        }
        return Ok(new { items = items.Take(limit) });
    }
}
