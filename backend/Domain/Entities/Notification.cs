namespace HomestayAuth.Api.Domain.Entities;

// In-app notification for one user (the bell). Staff notifications are copied to every Admin/Support user.
// The link is a typed target the frontend maps to a view, never a free URL.
public class Notification
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public required string Type { get; set; }
    public required string Title { get; set; }
    public required string Body { get; set; }
    public string? LinkType { get; set; }
    public long? LinkId { get; set; }
    public string? LinkExtra { get; set; }
    public DateTime? ReadAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public static class NotificationLink
{
    public const string Booking = "Booking";         // customer booking (My bookings)
    public const string HostBooking = "HostBooking"; // booking in the host dashboard
    public const string Homestay = "Homestay";       // public homestay page
    public const string HostTab = "HostTab";         // host dashboard tab (LinkExtra)
    public const string AdminTab = "AdminTab";       // admin tab (LinkExtra)
    public const string News = "News";              // news post (LinkExtra = slug)
}
