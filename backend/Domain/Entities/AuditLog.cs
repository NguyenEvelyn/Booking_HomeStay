namespace HomestayAuth.Api.Domain.Entities;

public class AuditLog
{
    public long Id { get; set; }
    public long? ActorId { get; set; }
    public required string ActorRole { get; set; }
    public required string Action { get; set; }
    public required string TargetType { get; set; }
    public required string TargetId { get; set; }
    public string? BeforeJson { get; set; }
    public string? AfterJson { get; set; }
    public string? Reason { get; set; }
    public System.Net.IPAddress? Ip { get; set; }
    public DateTime CreatedAt { get; set; }
}
