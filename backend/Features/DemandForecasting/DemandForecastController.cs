using HomestayAuth.Api.Features.Admin.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HomestayAuth.Api.Features.DemandForecasting;

[ApiController, Route("api/admin/ai/demand-forecast"), Authorize(Policy = AdminPolicies.Access)]
public sealed class DemandForecastController(DemandForecastService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? region = null,
        [FromQuery] int historyMonths = 36, [FromQuery] int horizon = 6) =>
        Ok(await service.Forecast(region, historyMonths, horizon));

    [HttpGet("regions")]
    public async Task<IActionResult> Regions() => Ok(new { items = await service.Regions() });
}
