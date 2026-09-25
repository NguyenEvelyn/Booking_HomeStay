namespace HomestayAuth.Api.Domain.Entities;

public class HostCustomerNote
{
    public long Id { get; set; }
    public long HostId { get; set; }
    public long CustomerId { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
