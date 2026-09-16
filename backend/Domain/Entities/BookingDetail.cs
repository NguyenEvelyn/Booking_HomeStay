namespace HomestayAuth.Api.Domain.Entities;

public class BookingDetail
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public long RoomTypeId { get; set; }
    public long? RoomId { get; set; }
    public int Quantity { get; set; }
    public decimal PricePerNight { get; set; }
    public int NumberOfNights { get; set; }
    public decimal ExtraFee { get; set; }
    public decimal LineTotal { get; set; }
    public string? GuestName { get; set; }
    public string? Note { get; set; }
    public Booking Booking { get; set; } = null!;
}
