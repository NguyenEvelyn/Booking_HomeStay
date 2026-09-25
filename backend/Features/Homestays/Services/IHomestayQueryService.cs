using HomestayAuth.Api.Features.Homestays.DTOs;

namespace HomestayAuth.Api.Features.Homestays.Services;

public interface IHomestayQueryService
{
    Task<PagedResponse<HomestayListItemResponse>> GetApprovedAsync(string? search, string? location, string? province, DateOnly? checkIn, DateOnly? checkOut, int guests, int rooms, decimal? maxPrice, string? roomType, int minRating, string? sort, int page, int pageSize);
    Task<HomestayDetailResponse?> GetApprovedDetailAsync(long homestayId);
    Task<IReadOnlyList<RoomTypeListItemResponse>?> GetActiveRoomTypesAsync(long homestayId);
    Task<RoomTypeDetailResponse?> GetActiveRoomTypeDetailAsync(long roomTypeId);
    Task<IReadOnlyList<HostHomestayListItemResponse>> GetForHostAsync(long hostId);
}
