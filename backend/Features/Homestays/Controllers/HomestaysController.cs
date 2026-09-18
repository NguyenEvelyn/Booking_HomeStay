using HomestayAuth.Api.Features.Homestays.Services;
using Microsoft.AspNetCore.Mvc;

namespace HomestayAuth.Api.Features.Homestays.Controllers;

[ApiController]
[Route("api/homestays")]
public sealed class HomestaysController(IHomestayQueryService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? province,
        [FromQuery] DateOnly? checkIn,
        [FromQuery] DateOnly? checkOut,
        [FromQuery] int guests = 1,
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
        if (checkIn.HasValue && checkIn < DateOnly.FromDateTime(DateTime.Today))
            return BadRequest(new { message = "Ngày nhận phòng không được ở trong quá khứ." });
        guests = Math.Clamp(guests, 1, 30);
        minRating = Math.Clamp(minRating, 0, 5);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);
        return Ok(await service.GetApprovedAsync(search, province, checkIn, checkOut, guests, maxPrice, roomType, minRating, sort, page, pageSize));
    }

    [HttpGet("{homestayId:long}")]
    public async Task<IActionResult> GetDetail(long homestayId)
    {
        var result = await service.GetApprovedDetailAsync(homestayId);
        return result is null ? NotFound(new { message = "Không tìm thấy homestay." }) : Ok(result);
    }

    [HttpGet("{homestayId:long}/room-types")]
    public async Task<IActionResult> GetRoomTypes(long homestayId)
    {
        var result = await service.GetActiveRoomTypesAsync(homestayId);
        return result is null ? NotFound(new { message = "Không tìm thấy homestay." }) : Ok(new { items = result });
    }
}
