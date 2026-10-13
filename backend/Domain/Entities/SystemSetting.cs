namespace HomestayAuth.Api.Domain.Entities;

public sealed class SystemSetting
{
    public string Key { get; set; } = "platform";
    public string ValueJson { get; set; } = "{}";
    public long? UpdatedBy { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
