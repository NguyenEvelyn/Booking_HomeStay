namespace HomestayAuth.Api.Domain.Entities;

public class BookingGuest
{
    public long Id { get; set; }
    public long BookingId { get; set; }
    public bool IsPrimary { get; set; }
    public required string GuestType { get; set; }
    public required string FullName { get; set; }
    public DateOnly? BirthDate { get; set; }
    public required string Gender { get; set; }
    public required string Nationality { get; set; }
    public required string DocumentType { get; set; }
    public string? DocumentNumber { get; set; }
    public string? Address { get; set; }
    public string? AccompanyingAdult { get; set; }
    public bool DeclarationDeferred { get; set; }
    public string DeclarationStatus { get; set; } = "Completed";
    public DateTime? DeclarationDueAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Booking Booking { get; set; } = null!;
}
