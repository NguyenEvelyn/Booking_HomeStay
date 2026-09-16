namespace HomestayAuth.Api.Features.Homestays.DTOs;

public sealed record ImageResponse(long Id, string Url, string? Caption, bool IsThumbnail, int SortOrder);
public sealed record AmenityResponse(int Id, string Name, string Category, string? IconUrl, string? Description);
public sealed record PublicRoomResponse(long Id, string RoomNumber, string Status, IReadOnlyList<ImageResponse> Images);

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
    IReadOnlyList<AmenityResponse> Amenities,
    IReadOnlyList<PublicRoomResponse> Rooms);

public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public sealed record SaveHomestayRequest(string Name, string Description, string AddressLine, string Ward, string District, string Province, TimeOnly? CheckInTime, TimeOnly? CheckOutTime);
public sealed record SaveRoomTypeRequest(string Name, string Description, decimal BasePrice, int MaxAdults, int MaxChildren, string BedType, decimal? RoomSize);
public sealed record SaveRoomRequest(string RoomNumber, int? FloorNumber, string Status, string? Note);
public sealed record SaveImageRequest(string ImageUrl, string? Caption, bool IsThumbnail);
public sealed record SaveAmenitiesRequest(IReadOnlyList<int> AmenityIds);
public sealed record SaveHostProfileRequest(string FullName, string? PhoneNumber, string? Bio, string? Address, string? AvatarUrl, string? CoverUrl);
public sealed record SavePricePeriodRequest(string Name, DateOnly StartDate, DateOnly EndDate, decimal PricePerNight);

#if false
public sealed record SaveHomestayRequest(
    string Name, string Description, string AddressLine, string Ward, string District,
    string Province, TimeOnly? CheckInTime, TimeOnly? CheckOutTime);
public sealed record SaveRoomTypeRequest(
    string Name, string Description, decimal BasePrice, int MaxAdults, int MaxChildren,
    string BedType, decimal? RoomSize);
public sealed record SaveRoomRequest(string RoomNumber, int? FloorNumber, string Status, string? Note);
public sealed record SaveImageRequest(string ImageUrl, string? Caption, bool IsThumbnail);
public sealed record SaveAmenitiesRequest(IReadOnlyList<int> AmenityIds);
#endif
