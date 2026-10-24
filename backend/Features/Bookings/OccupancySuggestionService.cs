using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

// Kind: "ChangeRoom" (larger room type, same homestay), "AddRoom" (more rooms, same homestay), "OtherHomestay" (same province).
public sealed record RoomSuggestion(string Kind, long HomestayId, string HomestayName, long RoomTypeId, string RoomTypeName, int Quantity,
    int Capacity, int MaxExtraChildren, decimal BasePrice, decimal NightlyDifference, int AvailableRooms);

// When a party does not fit, offer the agreed ladder: ① a larger room in the same homestay, ② splitting into more rooms,
// ③ only if neither exists, other homestays in the same province. Only room types with free rooms for the dates are returned.
public sealed class OccupancySuggestionService(AppDbContext db)
{
    private const int MaxRoomsPerSuggestion = 4;

    public async Task<IReadOnlyList<RoomSuggestion>> For(RoomType current, Party party, DateOnly checkIn, DateOnly checkOut, long? excludingBookingId = null)
    {
        var now = DateTime.UtcNow;
        var homestay = await db.Homestays.AsNoTracking().Where(h => h.Id == current.HomestayId).Select(h => new { h.Id, h.Name, h.Province }).SingleAsync();
        var currentNightly = current.BasePrice;
        var sameHomestay = await db.RoomTypes.AsNoTracking().Where(r => r.HomestayId == current.HomestayId && r.Status == "Active").ToListAsync();
        var available = new Dictionary<long, int>();
        async Task<int> Free(long roomTypeId)
        {
            if (!available.TryGetValue(roomTypeId, out var count))
                available[roomTypeId] = count = (await BookingAvailability.AvailableRoomIds(db, roomTypeId, checkIn, checkOut, now, excludingBookingId)).Count;
            return count;
        }
        bool Fits(RoomType r, int quantity) => OccupancyRules.Evaluate(party, quantity, r.BaseCapacity, r.MaxCapacity, r.ExtraGuestAllowed, r.MaxExtraChildren).Ok;
        RoomSuggestion Make(string kind, long homestayId, string homestayName, RoomType r, int quantity, int free) =>
            new(kind, homestayId, homestayName, r.Id, r.Name, quantity, r.BaseCapacity, r.MaxExtraChildren, r.BasePrice, r.BasePrice * quantity - currentNightly, free);

        // ① One larger room of another type.
        var change = new List<RoomSuggestion>();
        foreach (var r in sameHomestay.Where(r => r.Id != current.Id && Fits(r, 1)).OrderBy(r => r.BasePrice))
            if (await Free(r.Id) is var free && free >= 1) change.Add(Make("ChangeRoom", homestay.Id, homestay.Name, r, 1, free));

        // ② The fewest rooms (2..4) of a type that together fit the party; cheapest first.
        var add = new List<RoomSuggestion>();
        foreach (var r in sameHomestay)
            for (var quantity = 2; quantity <= MaxRoomsPerSuggestion; quantity++)
            {
                if (!Fits(r, quantity)) continue;
                if (await Free(r.Id) is var free && free >= quantity) add.Add(Make("AddRoom", homestay.Id, homestay.Name, r, quantity, free));
                break;
            }
        var result = change.Take(3).Concat(add.OrderBy(x => x.BasePrice * x.Quantity).Take(3)).ToList();
        if (result.Count > 0) return result;

        // ③ Nothing in this homestay: one room elsewhere in the same province.
        var others = await db.RoomTypes.AsNoTracking()
            .Where(r => r.Status == "Active" && r.HomestayId != current.HomestayId && r.Homestay.Status == "Approved" && r.Homestay.Province == homestay.Province)
            .OrderBy(r => r.BasePrice).Take(30)
            .Select(r => new { RoomType = r, HomestayName = r.Homestay.Name }).ToListAsync();
        foreach (var o in others.Where(o => Fits(o.RoomType, 1)))
        {
            if (await Free(o.RoomType.Id) is var free && free >= 1) result.Add(Make("OtherHomestay", o.RoomType.HomestayId, o.HomestayName, o.RoomType, 1, free));
            if (result.Count == 3) break;
        }
        return result;
    }
}
