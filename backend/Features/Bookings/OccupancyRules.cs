namespace HomestayAuth.Api.Features.Bookings;

// Who is staying, in the three groups the occupancy rules care about.
// Adults: from AdultAge. Tall children: under AdultAge and from 1.2 m. Small children: under 1.2 m.
public sealed record Party(int Adults, int TallChildren, int SmallChildren)
{
    public int Children => TallChildren + SmallChildren;
    public int Total => Adults + Children;
}

public sealed record OccupancyEvaluation(Party Party, int StandardSlots, int ExtraAdults, int ExtraTallChildren, int ExtraOccupants,
    int MaxExtraOccupants, string? Problem, string? Message)
{
    public bool Ok => Problem is null;
}

// Pure occupancy rules (no database):
//   - adults and tall children fill the standard capacity; small children never count toward it;
//   - tall children beyond it pay a fixed fee per night; small children are free;
//   - extra tall + small children are capped by the room type's MaxExtraChildren;
//   - adults beyond capacity must change room or add a room (unless the host opted in to paid extra adults);
//   - every room needs at least one adult.
public static class OccupancyRules
{
    public const string NoAdult = "NoAdult";
    public const string TooManyAdults = "TooManyAdults";
    public const string OverExtraLimit = "OverExtraLimit";
    // Without explicit height information (older clients) a child of this age or younger is assumed under 1.2 m.
    public const int AssumedSmallChildMaxAge = 6;

    public static Party FromCounts(int adults, int childCount, int? tallChildren, int? smallChildren, IReadOnlyList<int>? childAges, int adultAge)
    {
        if (tallChildren.HasValue || smallChildren.HasValue)
            return new Party(adults, Math.Max(0, tallChildren ?? 0), Math.Max(0, smallChildren ?? 0));
        if (childAges is { Count: > 0 })
        {
            // Age decides who is an adult; height is unknown, so young children are assumed small.
            var grownUps = childAges.Count(a => a >= adultAge);
            var small = childAges.Count(a => a < adultAge && a <= AssumedSmallChildMaxAge);
            return new Party(adults + grownUps, childAges.Count - grownUps - small, small);
        }
        // No detail at all: charge conservatively as tall children.
        return new Party(adults, Math.Max(0, childCount), 0);
    }

    public static OccupancyEvaluation Evaluate(Party party, int quantity, int baseCapacity, int maxCapacity, bool extraAdultsAllowed, int maxExtraChildren)
    {
        quantity = Math.Max(1, quantity);
        var standard = Math.Max(1, baseCapacity) * quantity;
        var adultLimit = (extraAdultsAllowed ? Math.Max(baseCapacity, maxCapacity) : baseCapacity) * quantity;
        var maxExtra = Math.Max(0, maxExtraChildren) * quantity;
        if (party.Adults < quantity)
            return new(party, standard, 0, 0, 0, maxExtra, NoAdult, "Mỗi phòng cần ít nhất 1 người lớn (từ 12 tuổi).");
        if (party.Adults > adultLimit)
            return new(party, standard, 0, 0, 0, maxExtra, TooManyAdults,
                $"Phòng chỉ nhận tối đa {adultLimit} người lớn. Vui lòng đổi sang phòng lớn hơn hoặc đặt thêm phòng.");
        var extraAdults = Math.Max(0, party.Adults - standard);
        var extraTall = Math.Max(0, party.Adults + party.TallChildren - standard) - extraAdults;
        var extraOccupants = extraTall + party.SmallChildren;
        if (extraOccupants > maxExtra)
            return new(party, standard, extraAdults, extraTall, extraOccupants, maxExtra, OverExtraLimit,
                maxExtra == 0
                    ? $"Phòng không nhận ở thêm ngoài sức chứa {standard} người (trẻ em cao từ 1m2 được tính như một chỗ). Vui lòng chọn phòng lớn hơn."
                    : $"Phòng chỉ nhận ở thêm tối đa {maxExtra} trẻ em ngoài sức chứa {standard} người. Vui lòng chọn phòng lớn hơn hoặc đặt thêm phòng.");
        return new(party, standard, extraAdults, extraTall, extraOccupants, maxExtra, null, null);
    }

    /// <summary>Maximum people a room type can physically take (used to pre-filter search results).</summary>
    public static int MaxOccupancy(int baseCapacity, int maxCapacity, bool extraAdultsAllowed, int maxExtraChildren) =>
        (extraAdultsAllowed ? Math.Max(baseCapacity, maxCapacity) : baseCapacity) + Math.Max(0, maxExtraChildren);
}
