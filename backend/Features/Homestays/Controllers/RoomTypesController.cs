using HomestayAuth.Api.Features.Homestays.Services;
using Microsoft.AspNetCore.Mvc;

namespace HomestayAuth.Api.Features.Homestays.Controllers;

[ApiController]
[Route("api/room-types")]
public sealed class RoomTypesController(IHomestayQueryService service) : ControllerBase
{
    [HttpGet("{roomTypeId:long}")]
    public async Task<IActionResult> GetDetail(long roomTypeId)
    {
        var result = await service.GetActiveRoomTypeDetailAsync(roomTypeId);
        return result is null ? NotFound(new { message = "Không tìm thấy loại phòng." }) : Ok(result);
    }
}
