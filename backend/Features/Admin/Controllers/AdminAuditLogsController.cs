using System.Text.Json;
using HomestayAuth.Api.Features.Admin.Authorization;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Admin.Controllers;

[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Policy = AdminPolicies.Access)]
public sealed class AdminAuditLogsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] long? actorId = null, [FromQuery] string? action = null,
        [FromQuery] string? targetType = null, [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null, [FromQuery] string sort = "createdAt_desc")
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = db.AuditLogs.AsNoTracking();
        if (actorId.HasValue) query = query.Where(x => x.ActorId == actorId);
        if (!string.IsNullOrWhiteSpace(action)) query = query.Where(x => x.Action == action.Trim());
        if (!string.IsNullOrWhiteSpace(targetType)) query = query.Where(x => x.TargetType == targetType.Trim());
        if (from.HasValue) query = query.Where(x => x.CreatedAt >= from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        if (to.HasValue) query = query.Where(x => x.CreatedAt < to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        query = sort == "createdAt_asc" ? query.OrderBy(x => x.CreatedAt) : query.OrderByDescending(x => x.CreatedAt);
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new
            {
                x.Id, x.ActorId, ActorName = db.Users.Where(u => u.Id == x.ActorId).Select(u => u.FullName).FirstOrDefault(),
                x.ActorRole, x.Action, x.TargetType, x.TargetId, x.Reason, x.Ip, x.CreatedAt
            }).ToListAsync();
        return Ok(new { items, page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> Detail(long id)
    {
        var item = await db.AuditLogs.AsNoTracking().Where(x => x.Id == id).Select(x => new
        {
            x.Id, x.ActorId, ActorName = db.Users.Where(u => u.Id == x.ActorId).Select(u => u.FullName).FirstOrDefault(),
            x.ActorRole, x.Action, x.TargetType, x.TargetId, x.BeforeJson, x.AfterJson, x.Reason, x.Ip, x.CreatedAt
        }).SingleOrDefaultAsync();
        if (item is null) return NotFound(new { message = "Không tìm thấy nhật ký hoạt động." });
        return Ok(new
        {
            item.Id, item.ActorId, item.ActorName, item.ActorRole, item.Action, item.TargetType, item.TargetId,
            before = ParseJson(item.BeforeJson), after = ParseJson(item.AfterJson), item.Reason, item.Ip, item.CreatedAt
        });
    }

    [HttpGet("filters")]
    public async Task<IActionResult> Filters() => Ok(new
    {
        actors = await db.AuditLogs.AsNoTracking().Where(x => x.ActorId != null).Select(x => new
        { id = x.ActorId, name = db.Users.Where(u => u.Id == x.ActorId).Select(u => u.FullName).FirstOrDefault() }).Distinct().OrderBy(x => x.name).ToListAsync(),
        actions = await db.AuditLogs.AsNoTracking().Select(x => x.Action).Distinct().OrderBy(x => x).ToListAsync(),
        targetTypes = await db.AuditLogs.AsNoTracking().Select(x => x.TargetType).Distinct().OrderBy(x => x).ToListAsync()
    });

    private static object? ParseJson(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        using var document = JsonDocument.Parse(value);
        return document.RootElement.Clone();
    }
}
