namespace HomestayAuth.Api.Domain.Entities;

public class BookingConflictEvent
{
    public long Id { get; set; }
    public long? CustomerId { get; set; }
    public long RoomTypeId { get; set; }
    public DateOnly CheckInDate { get; set; }
    public DateOnly CheckOutDate { get; set; }
    public int RequestedQuantity { get; set; }
    public int AvailableQuantity { get; set; }
    public DateTime CreatedAt { get; set; }
}
