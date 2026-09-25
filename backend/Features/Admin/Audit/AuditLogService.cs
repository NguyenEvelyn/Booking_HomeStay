using System.Security.Claims;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;

namespace HomestayAuth.Api.Features.Admin.Audit;

public interface IAuditLogService
{
    void Add(HttpContext context, string action, string targetType, object targetId,
        object? before = null, object? after = null, string? reason = null);
}

public sealed class AuditLogService(AppDbContext db) : IAuditLogService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public void Add(HttpContext context, string action, string targetType, object targetId,
        object? before = null, object? after = null, string? reason = null)
    {
        var actorId = long.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : (long?)null;
        db.AuditLogs.Add(new AuditLog
        {
            ActorId = actorId,
            ActorRole = context.User.FindFirstValue(ClaimTypes.Role) ?? "Unknown",
            Action = action,
            TargetType = targetType,
            TargetId = Convert.ToString(targetId, System.Globalization.CultureInfo.InvariantCulture) ?? "",
            BeforeJson = before is null ? null : JsonSerializer.Serialize(before, JsonOptions),
            AfterJson = after is null ? null : JsonSerializer.Serialize(after, JsonOptions),
            Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(),
            Ip = context.Connection.RemoteIpAddress,
            CreatedAt = DateTime.UtcNow
        });
    }
}
