namespace HomestayAuth.Api.Features.Homestays.DTOs;

public sealed record ImageResponse(long Id, string Url, string? Caption, bool IsThumbnail, int SortOrder);
public sealed record AmenityResponse(int Id, string Name, string Category, string? IconUrl, string? Description);

public sealed record HomestayListItemResponse(
    long Id,
    string Name,
    string Address,
    string District,
    string Province,
    string? ThumbnailUrl,
    decimal? FromPrice,
    int ActiveRoomTypeCount,
    int AvailableRoomCount,
    decimal? AverageRating,
    int ReviewCount,
    IReadOnlyList<string> RoomTypeNames);

public sealed record HostHomestayListItemResponse(
    long Id,
    string Name,
    string Address,
    string District,
    string Province,
    string Status,
    string? ThumbnailUrl,
    int RoomTypeCount,
    int PhysicalRoomCount,
    DateTime UpdatedAt);

public sealed record RoomTypeListItemResponse(
    long Id,
    string Name,
    string Description,
    decimal BasePrice,
    int MaxAdults,
    int MaxChildren,
    string BedType,
    decimal? RoomSize,
    string? ThumbnailUrl,
    int AvailableRoomCount);

public sealed record HomestayDetailResponse(
    long Id,
    string Name,
    string Description,
    string AddressLine,
    string Ward,
    string District,
    string Province,
    decimal? Latitude,
    decimal? Longitude,
    TimeOnly CheckInTime,
    TimeOnly CheckOutTime,
    IReadOnlyList<ImageResponse> Images,
    IReadOnlyList<AmenityResponse> Amenities,
    IReadOnlyList<RoomTypeListItemResponse> RoomTypes);

public sealed record RoomTypeDetailResponse(
    long Id,
    long HomestayId,
    string HomestayName,
    string Name,
    string Description,
    decimal BasePrice,
    int MaxAdults,
    int MaxChildren,
    string BedType,
    decimal? RoomSize,
    int AvailableRoomCount,
    IReadOnlyList<ImageResponse> Images,
    IReadOnlyList<AmenityResponse> Amenities);

public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
