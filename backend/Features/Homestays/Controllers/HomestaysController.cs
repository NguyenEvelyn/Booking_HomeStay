using System.Security.Claims;
using HomestayAuth.Api.Features.Bookings;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Homestays.Controllers;

[ApiController]
[Route("api/homestays")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class HomestaysController(IHomestayQueryService service, AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? location,
        [FromQuery] string? province,
        [FromQuery] DateOnly? checkIn,
        [FromQuery] DateOnly? checkOut,
        [FromQuery] int guests = 1,
        [FromQuery] int rooms = 1,
        [FromQuery] decimal? maxPrice = null,
        [FromQuery] string? roomType = null,
        [FromQuery] int minRating = 0,
        [FromQuery] string? sort = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12)
    {
        if (checkIn.HasValue != checkOut.HasValue)
            return BadRequest(new { message = "Vui lòng chọn đầy đủ ngày nhận và ngày trả phòng." });
        if (checkIn.HasValue && checkOut <= checkIn)
            return BadRequest(new { message = "Ngày trả phòng phải sau ngày nhận phòng." });
        if (checkIn.HasValue && checkIn < BookingRules.Today)
            return BadRequest(new { message = "Ngày nhận phòng không được ở trong quá khứ." });
        guests = Math.Clamp(guests, 1, 30);
        rooms = Math.Clamp(rooms, 1, 10);
        minRating = Math.Clamp(minRating, 0, 5);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);
        return Ok(await service.GetApprovedAsync(search, location, province, checkIn, checkOut, guests, rooms, maxPrice, roomType, minRating, sort, page, pageSize));
    }

    [HttpGet("{homestayId:long}")]
    public async Task<IActionResult> GetDetail(long homestayId)
    {
        var result = await service.GetApprovedDetailAsync(homestayId);
        return result is null ? NotFound(new { message = "Không tìm thấy homestay." }) : Ok(result);
    }

    // Lets the detail page replace the booking box for the homestay's own host (see BookingRules.IsOwnHomestay).
    [Authorize, HttpGet("{homestayId:long}/ownership")]
    public async Task<IActionResult> GetOwnership(long homestayId)
    {
        var userId = long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsed) ? parsed : 0;
        return Ok(new { isOwner = await db.Homestays.AsNoTracking().AnyAsync(h => h.Id == homestayId && h.HostId == userId) });
    }

    [HttpGet("{homestayId:long}/room-types")]
    public async Task<IActionResult> GetRoomTypes(long homestayId)
    {
        var result = await service.GetActiveRoomTypesAsync(homestayId);
        return result is null ? NotFound(new { message = "Không tìm thấy homestay." }) : Ok(new { items = result });
    }

    [HttpGet("{homestayId:long}/availability")]
    public async Task<IActionResult> GetAvailability(long homestayId, [FromQuery] DateOnly checkIn,
        [FromQuery] DateOnly checkOut, [FromQuery] int guests = 1, [FromQuery] int rooms = 1)
    {
        var dateError = BookingRules.ValidateDates(checkIn, checkOut, BookingRules.Today);
        if (dateError is not null) return BadRequest(new { message = dateError });
        if (guests < 1 || guests > 30 || rooms < 1 || rooms > 10)
            return BadRequest(new { message = "Số khách hoặc số phòng không hợp lệ." });
        var roomTypes = await service.GetActiveRoomTypesAsync(homestayId);
        if (roomTypes is null) return NotFound(new { message = "Không tìm thấy homestay." });
        var items = new List<object>();
        foreach (var roomType in roomTypes)
        {
            var capacity = OccupancyRules.MaxOccupancy(roomType.BaseCapacity, roomType.MaxCapacity, roomType.ExtraGuestAllowed, roomType.MaxExtraChildren);
            if (capacity * rooms < guests) continue;
            var available = (await BookingAvailability.AvailableRoomIds(db, roomType.Id, checkIn, checkOut, DateTime.UtcNow)).Count;
            if (available >= rooms) items.Add(new { roomTypeId = roomType.Id, availableRooms = available });
        }
        return Ok(new { items });
    }
}
