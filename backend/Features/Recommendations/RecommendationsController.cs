using HomestayAuth.Api.Features.Bookings;
using Microsoft.AspNetCore.Mvc;

namespace HomestayAuth.Api.Features.Recommendations;

[ApiController]
[Route("api/recommendations")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class RecommendationsController(RecommendationService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? search, [FromQuery] string? location, [FromQuery] DateOnly? checkIn,
        [FromQuery] DateOnly? checkOut, [FromQuery] int guests = 2, [FromQuery] int? adults = null,
        [FromQuery] int children = 0, [FromQuery] int rooms = 1,
        [FromQuery] decimal? totalBudget = null, [FromQuery] string? amenities = null,
        [FromQuery] string? roomType = null, [FromQuery] int minRating = 0, [FromQuery] int topK = 5,
        [FromQuery] string? sessionId = null)
    {
        if (checkIn.HasValue != checkOut.HasValue)
            return BadRequest(new { message = "Vui lòng chọn đủ ngày nhận và trả phòng." });
        if (checkIn.HasValue && BookingRules.ValidateDates(checkIn.Value, checkOut!.Value, BookingRules.Today) is { } dateError)
            return BadRequest(new { message = dateError });
        var resolvedAdults = adults ?? guests - children;
        if (guests is < 1 or > 30 || resolvedAdults is < 1 or > 30 || children is < 0 or > 20
            || resolvedAdults + children != guests || rooms is < 1 or > 10 || totalBudget is <= 0)
            return BadRequest(new { message = "Số khách, số phòng hoặc ngân sách không hợp lệ." });
        if (sessionId is not null && !Guid.TryParse(sessionId, out _))
            return BadRequest(new { message = "Mã phiên không hợp lệ." });
        var query = new RecommendationQuery(search, location, checkIn, checkOut, guests, resolvedAdults, children, rooms, totalBudget, amenities,
            roomType, Math.Clamp(minRating, 0, 5),
            Math.Clamp(topK, 1, 10), sessionId);
        return Ok(new { modelVersion = service.ModelVersion, items = await service.Recommend(query, User) });
    }
}
