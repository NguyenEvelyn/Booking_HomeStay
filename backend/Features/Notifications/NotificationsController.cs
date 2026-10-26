using System.Security.Claims;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Notifications;

// The signed-in user's own notifications (bell). Every query is scoped to the caller's id.
[ApiController, Route("api/notifications"), Authorize]
public sealed class NotificationsController(AppDbContext db) : ControllerBase
{
    private long UserId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] long? before, [FromQuery] int limit = 20)
    {
        limit = Math.Clamp(limit, 1, 50);
        var items = await db.Notifications.AsNoTracking().Where(x => x.UserId == UserId && (!before.HasValue || x.Id < before))
            .OrderByDescending(x => x.Id).Take(limit)
            .Select(x => new { x.Id, x.Type, x.Title, x.Body, link = x.LinkType == null ? null : new { type = x.LinkType, id = x.LinkId, extra = x.LinkExtra },
                isRead = x.ReadAt != null, x.CreatedAt })
            .ToListAsync();
        return Ok(new { items, hasMore = items.Count == limit });
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount() =>
        Ok(new { count = await db.Notifications.CountAsync(x => x.UserId == UserId && x.ReadAt == null) });

    [HttpPost("{id:long}/read")]
    public async Task<IActionResult> Read(long id)
    {
        await db.Notifications.Where(x => x.Id == id && x.UserId == UserId && x.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ReadAt, DateTime.UtcNow));
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> ReadAll()
    {
        await db.Notifications.Where(x => x.UserId == UserId && x.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ReadAt, DateTime.UtcNow));
        return NoContent();
    }
}
