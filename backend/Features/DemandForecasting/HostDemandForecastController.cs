using System.Security.Claims;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.DemandForecasting;

[ApiController, Route("api/host/ai/demand-forecast"), Authorize(Roles = "Host")]
public sealed class HostDemandForecastController(AppDbContext db, DemandForecastService service) : ControllerBase
{
    private long HostId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] long homestayId,
        [FromQuery] int historyMonths = 24, [FromQuery] int horizon = 6)
    {
        if (homestayId <= 0) return BadRequest(new { message = "Vui lòng chọn homestay." });
        var owned = await db.Homestays.AsNoTracking().AnyAsync(x => x.Id == homestayId && x.HostId == HostId);
        if (!owned) return NotFound(new { message = "Không tìm thấy homestay thuộc tài khoản của bạn." });
        return Ok(await service.ForecastForHomestay(homestayId,
            Math.Clamp(historyMonths, 6, 60), Math.Clamp(horizon, 1, 12)));
    }
}
