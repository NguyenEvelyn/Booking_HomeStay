using HomestayAuth.Api.Features.Homestays.DTOs;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Homestays.Services;

public sealed class HomestayQueryService(AppDbContext db) : IHomestayQueryService
{
    public async Task<PagedResponse<HomestayListItemResponse>> GetApprovedAsync(
        string? search, string? province, DateOnly? checkIn, DateOnly? checkOut, int guests,
        decimal? maxPrice, string? roomType, int minRating, string? sort, int page, int pageSize)
    {
        var query = db.Homestays.AsNoTracking().Where(h => h.Status == "Approved");
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(h => EF.Functions.ILike(h.Name, pattern)
                || EF.Functions.ILike(h.District, pattern)
                || EF.Functions.ILike(h.Province, pattern));
        }
        if (!string.IsNullOrWhiteSpace(province))
            query = query.Where(h => EF.Functions.ILike(h.Province, province.Trim()));

        var blockingStatuses = new[] { "PendingPayment", "Confirmed" };
        query = query.Where(h => h.RoomTypes.Any(r => r.Status == "Active"
            && r.MaxAdults + r.MaxChildren >= guests
            && (!maxPrice.HasValue || r.BasePrice <= maxPrice.Value)
            && (string.IsNullOrWhiteSpace(roomType) || EF.Functions.ILike(r.Name, $"%{roomType!.Trim()}%"))
            && (!checkIn.HasValue ||
                r.Rooms.Count(room => room.Status == "Available") > (db.BookingDetails
                    .Where(d => d.RoomTypeId == r.Id && blockingStatuses.Contains(d.Booking.Status)
                        && d.Booking.CheckInDate < checkOut!.Value && d.Booking.CheckOutDate > checkIn.Value)
                    .Sum(d => (int?)d.Quantity) ?? 0))));
        if (minRating > 0)
            query = query.Where(h => db.Reviews.Any(r => r.HomestayId == h.Id && r.Status == "Visible")
                && db.Reviews.Where(r => r.HomestayId == h.Id && r.Status == "Visible").Average(r => r.Rating) >= minRating);

        var total = await query.CountAsync();
        query = sort == "price-low" ? query.OrderBy(h => h.RoomTypes.Where(r => r.Status == "Active").Min(r => r.BasePrice))
            : sort == "rating" ? query.OrderByDescending(h => db.Reviews.Where(r => r.HomestayId == h.Id && r.Status == "Visible").Average(r => (double?)r.Rating) ?? 0)
            : query.OrderByDescending(h => h.CreatedAt);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(h => new HomestayListItemResponse(
                h.Id,
                h.Name,
                h.AddressLine,
                h.District,
                h.Province,
                h.Images.Where(i => i.IsThumbnail).Select(i => i.ImageUrl).FirstOrDefault(),
                h.RoomTypes.Where(r => r.Status == "Active" && r.MaxAdults + r.MaxChildren >= guests
                    && (!maxPrice.HasValue || r.BasePrice <= maxPrice.Value)
                    && (string.IsNullOrWhiteSpace(roomType) || EF.Functions.ILike(r.Name, $"%{roomType!.Trim()}%")))
                    .Select(r => (decimal?)r.BasePrice).Min(),
                h.RoomTypes.Count(r => r.Status == "Active"),
                h.RoomTypes.Where(r => r.Status == "Active").SelectMany(r => r.Rooms).Count(room => room.Status == "Available")
                    - (!checkIn.HasValue ? 0 : db.BookingDetails.Where(d => d.Booking.HomestayId == h.Id && blockingStatuses.Contains(d.Booking.Status)
                        && d.Booking.CheckInDate < checkOut!.Value && d.Booking.CheckOutDate > checkIn.Value).Sum(d => (int?)d.Quantity) ?? 0),
                db.Reviews.Where(r => r.HomestayId == h.Id && r.Status == "Visible").Average(r => (decimal?)r.Rating),
                db.Reviews.Count(r => r.HomestayId == h.Id && r.Status == "Visible"),
                h.RoomTypes.Where(r => r.Status == "Active").OrderBy(r => r.BasePrice).Select(r => r.Name).ToList()))
            .ToListAsync();
        return new PagedResponse<HomestayListItemResponse>(items, total, page, pageSize);
    }

    public Task<HomestayDetailResponse?> GetApprovedDetailAsync(long homestayId) =>
        db.Homestays.AsNoTracking()
            .Where(h => h.Id == homestayId && h.Status == "Approved")
            .Select(h => new HomestayDetailResponse(
                h.Id, h.Name, h.Description, h.AddressLine, h.Ward, h.District, h.Province,
                h.Latitude, h.Longitude, h.CheckInTime, h.CheckOutTime,
                h.Images.OrderBy(i => i.SortOrder)
                    .Select(i => new ImageResponse(i.Id, i.ImageUrl, i.Caption, i.IsThumbnail, i.SortOrder)).ToList(),
                h.HomestayAmenities.OrderBy(x => x.Amenity.Category).ThenBy(x => x.Amenity.Name)
                    .Select(x => new AmenityResponse(x.Amenity.Id, x.Amenity.Name, x.Amenity.Category, x.Amenity.IconUrl, x.Amenity.Description)).ToList(),
                h.RoomTypes.Where(r => r.Status == "Active").OrderBy(r => r.BasePrice)
                    .Select(r => new RoomTypeListItemResponse(
                        r.Id, r.Name, r.Description, r.BasePrice, r.MaxAdults, r.MaxChildren,
                        r.BedType, r.RoomSize,
                        r.Images.Where(i => i.IsThumbnail).Select(i => i.ImageUrl).FirstOrDefault(),
                        r.Rooms.Count(room => room.Status == "Available"))).ToList()))
            .SingleOrDefaultAsync();

    public async Task<IReadOnlyList<RoomTypeListItemResponse>?> GetActiveRoomTypesAsync(long homestayId)
    {
        if (!await db.Homestays.AsNoTracking().AnyAsync(h => h.Id == homestayId && h.Status == "Approved"))
            return null;
        return await db.RoomTypes.AsNoTracking()
            .Where(r => r.HomestayId == homestayId && r.Status == "Active")
            .OrderBy(r => r.BasePrice)
            .Select(r => new RoomTypeListItemResponse(
                r.Id, r.Name, r.Description, r.BasePrice, r.MaxAdults, r.MaxChildren,
                r.BedType, r.RoomSize,
                r.Images.Where(i => i.IsThumbnail).Select(i => i.ImageUrl).FirstOrDefault(),
                r.Rooms.Count(room => room.Status == "Available")))
            .ToListAsync();
    }

    public Task<RoomTypeDetailResponse?> GetActiveRoomTypeDetailAsync(long roomTypeId) =>
        db.RoomTypes.AsNoTracking()
            .Where(r => r.Id == roomTypeId && r.Status == "Active" && r.Homestay.Status == "Approved")
            .Select(r => new RoomTypeDetailResponse(
                r.Id, r.HomestayId, r.Homestay.Name, r.Name, r.Description, r.BasePrice,
                r.MaxAdults, r.MaxChildren, r.BedType, r.RoomSize,
                r.Rooms.Count(room => room.Status == "Available"),
                r.Images.OrderBy(i => i.SortOrder)
                    .Select(i => new ImageResponse(i.Id, i.ImageUrl, i.Caption, i.IsThumbnail, i.SortOrder)).ToList(),
                r.RoomTypeAmenities.OrderBy(x => x.Amenity.Category).ThenBy(x => x.Amenity.Name)
                    .Select(x => new AmenityResponse(x.Amenity.Id, x.Amenity.Name, x.Amenity.Category, x.Amenity.IconUrl, x.Amenity.Description)).ToList()))
            .SingleOrDefaultAsync();

    public async Task<IReadOnlyList<HostHomestayListItemResponse>> GetForHostAsync(long hostId) =>
        await db.Homestays.AsNoTracking()
            .Where(h => h.HostId == hostId)
            .OrderByDescending(h => h.UpdatedAt)
            .Select(h => new HostHomestayListItemResponse(
                h.Id, h.Name, h.AddressLine, h.District, h.Province, h.Status,
                h.Images.Where(i => i.IsThumbnail).Select(i => i.ImageUrl).FirstOrDefault(),
                h.RoomTypes.Count(),
                h.RoomTypes.SelectMany(r => r.Rooms).Count(),
                h.UpdatedAt))
            .ToListAsync();
}
