using HomestayAuth.Api.Features.Bookings;
using System.Security.Claims;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Homestays.DTOs;

namespace HomestayAuth.Api.Features.Homestays.Controllers;

public sealed record HostBookingStatusRequest(string Status);
public sealed record HostCancellationDecisionRequest(bool Approve);
public sealed record HostBookingNoteRequest(string? Note);
public sealed record HostOfflinePaymentRequest(string Method);

[ApiController]
[Route("api/host/homestays")]
[Authorize(Roles = "Host")]
public sealed class HostHomestaysController(IHomestayQueryService service, AppDbContext db, SupabaseStorageService storage) : ControllerBase
{
    private long HostId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetMine()
    {
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        return Ok(new { items = await service.GetForHostAsync(hostId) });
    }

    [HttpGet("amenities")]
    public async Task<IActionResult> Amenities() => Ok(new { items = await db.Amenities.AsNoTracking().OrderBy(x => x.Category).ThenBy(x => x.Name).ToListAsync() });

    [HttpGet("rooms/manage")]
    public async Task<IActionResult> ManageRooms()
    {
        var homestays = await db.Homestays.AsNoTracking().Where(h => h.HostId == HostId).OrderBy(h => h.Name)
            .Select(h => new { h.Id, h.Name, h.Status, RoomTypes = h.RoomTypes.OrderBy(r => r.Name).Select(r => new { r.Id, r.Name }).ToList() }).ToListAsync();
        var items = await db.Rooms.AsNoTracking().Where(r => r.RoomType.Homestay.HostId == HostId).OrderBy(r => r.RoomType.Homestay.Name).ThenBy(r => r.RoomNumber)
            .Select(r => new { r.Id, r.RoomNumber, r.FloorNumber, r.Status, r.Note, RoomTypeId = r.RoomTypeId, RoomTypeName = r.RoomType.Name,
                HomestayId = r.RoomType.HomestayId, HomestayName = r.RoomType.Homestay.Name, r.RoomType.MaxAdults, r.RoomType.MaxChildren,
                r.RoomType.BaseCapacity, r.RoomType.MaxCapacity, r.RoomType.ExtraGuestAllowed,
                r.RoomType.BasePrice, ThumbnailUrl = r.Images.OrderByDescending(i => i.IsThumbnail).ThenBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                Images = r.Images.OrderByDescending(i => i.IsThumbnail).ThenBy(i => i.SortOrder).Select(i => new { i.Id, Url = i.ImageUrl, i.Caption, i.IsThumbnail }).ToList() }).ToListAsync();
        return Ok(new { items, homestays });
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> Detail(long id)
    {
        var item = await db.Homestays.AsNoTracking().Where(h => h.Id == id && h.HostId == HostId)
            .Select(h => new { h.Id, h.Name, h.Description, h.AddressLine, h.Ward, h.District, h.Province, h.CheckInTime, h.CheckOutTime, h.Status, h.RejectionReason,
                Amenities = h.HomestayAmenities.Select(x => new { x.AmenityId, x.Amenity.Name, x.Amenity.Category }).ToList(),
                Images = h.Images.OrderBy(x => x.SortOrder).Select(x => new { x.Id, Url = x.ImageUrl, x.Caption, x.IsThumbnail }).ToList(),
                RoomTypes = h.RoomTypes.OrderBy(x => x.BasePrice).Select(r => new { r.Id, r.Name, r.Description, r.BasePrice, r.MaxAdults, r.MaxChildren, r.BaseCapacity, r.MaxCapacity, r.ExtraGuestAllowed, r.ExtraGuestFee, r.ExtraChildFee, r.ChildMaxAge, r.BedType, r.RoomSize, r.Status,
                    Rooms = r.Rooms.OrderBy(x => x.RoomNumber).Select(x => new { x.Id, x.RoomNumber, x.FloorNumber, x.Status, x.Note }).ToList(),
                    PricePeriods = r.PricePeriods.OrderBy(x => x.StartDate).Select(x => new { x.Id, x.Name, x.StartDate, x.EndDate, x.PricePerNight }).ToList() }).ToList()
            }).SingleOrDefaultAsync();
        return item is null ? NotFound(new { message = "Không tìm thấy homestay." }) : Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create(SaveHomestayRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Description) || string.IsNullOrWhiteSpace(request.AddressLine) || string.IsNullOrWhiteSpace(request.District) || string.IsNullOrWhiteSpace(request.Province)) return BadRequest(new { message = "Vui lòng nhập đầy đủ thông tin homestay." });
        var now = DateTime.UtcNow;
        var item = new Homestay { HostId = HostId, Name = request.Name.Trim(), Description = request.Description.Trim(), AddressLine = request.AddressLine.Trim(), Ward = request.Ward?.Trim() ?? "", District = request.District.Trim(), Province = request.Province.Trim(), CheckInTime = request.CheckInTime ?? new TimeOnly(14, 0), CheckOutTime = request.CheckOutTime ?? new TimeOnly(12, 0), Status = "Draft", CreatedAt = now, UpdatedAt = now };
        db.Homestays.Add(item); await db.SaveChangesAsync(); return Ok(new { item.Id, message = "Đã tạo bản nháp homestay." });
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, SaveHomestayRequest request)
    {
        var item = await db.Homestays.SingleOrDefaultAsync(h => h.Id == id && h.HostId == HostId);
        if (item is null) return NotFound(new { message = "Không tìm thấy homestay." });
        item.Name = request.Name.Trim(); item.Description = request.Description.Trim(); item.AddressLine = request.AddressLine.Trim(); item.Ward = request.Ward?.Trim() ?? ""; item.District = request.District.Trim(); item.Province = request.Province.Trim(); item.CheckInTime = request.CheckInTime ?? item.CheckInTime; item.CheckOutTime = request.CheckOutTime ?? item.CheckOutTime; item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = item.Status == "Approved" ? "Đã cập nhật Homestay. Thay đổi có hiệu lực ngay, không cần duyệt lại." : "Đã lưu thông tin Homestay." });
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var item = await db.Homestays.SingleOrDefaultAsync(h => h.Id == id && h.HostId == HostId);
        if (item is null) return NotFound(new { message = "Không tìm thấy homestay." });
        if (item.Status is not ("Draft" or "Rejected")) return BadRequest(new { message = "Chỉ có thể xóa bản nháp hoặc hồ sơ bị từ chối." });
        db.Homestays.Remove(item); await db.SaveChangesAsync(); return Ok(new { message = "Đã xóa homestay." });
    }

    [HttpPut("{id:long}/amenities")]
    public async Task<IActionResult> SaveAmenities(long id, SaveAmenitiesRequest request)
    {
        if (!await db.Homestays.AnyAsync(h => h.Id == id && h.HostId == HostId)) return NotFound(new { message = "Không tìm thấy homestay." });
        db.HomestayAmenities.RemoveRange(db.HomestayAmenities.Where(x => x.HomestayId == id));
        var validIds = await db.Amenities.Where(x => request.AmenityIds.Contains(x.Id)).Select(x => x.Id).ToListAsync();
        db.HomestayAmenities.AddRange(validIds.Distinct().Select(x => new HomestayAmenity { HomestayId = id, AmenityId = x }));
        await db.SaveChangesAsync(); return Ok(new { message = "Đã cập nhật tiện ích." });
    }

    [HttpPost("{id:long}/images")]
    public async Task<IActionResult> AddImage(long id, SaveImageRequest request)
    {
        if (!await db.Homestays.AnyAsync(h => h.Id == id && h.HostId == HostId)) return NotFound(new { message = "Không tìm thấy homestay." });
        if (request.IsThumbnail) await db.HomestayImages.Where(x => x.HomestayId == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsThumbnail, false));
        var image = new HomestayImage { HomestayId = id, ImageUrl = request.ImageUrl.Trim(), Caption = request.Caption?.Trim(), IsThumbnail = request.IsThumbnail, SortOrder = await db.HomestayImages.CountAsync(x => x.HomestayId == id), CreatedAt = DateTime.UtcNow };
        db.HomestayImages.Add(image); await db.SaveChangesAsync(); return Ok(new { message = "Đã thêm hình ảnh." });
    }

    [HttpDelete("{id:long}/images/{imageId:long}")]
    public async Task<IActionResult> DeleteImage(long id, long imageId)
    {
        var image = await db.HomestayImages.SingleOrDefaultAsync(x => x.Id == imageId && x.HomestayId == id && x.Homestay.HostId == HostId);
        if (image is null) return NotFound(new { message = "Không tìm thấy ảnh." });
        await storage.DeletePublicImageIfManagedAsync(image.ImageUrl, HttpContext.RequestAborted);
        db.HomestayImages.Remove(image); await db.SaveChangesAsync(); return Ok(new { message = "Đã xóa ảnh." });
    }

    [HttpPost("{id:long}/room-types")]
    public async Task<IActionResult> AddRoomType(long id, SaveRoomTypeRequest request)
    {
        if (!await db.Homestays.AnyAsync(h => h.Id == id && h.HostId == HostId)) return NotFound(new { message = "Không tìm thấy homestay." });
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Description) || string.IsNullOrWhiteSpace(request.BedType) || request.BasePrice <= 0 || request.MaxAdults < 1 || request.MaxChildren < 0)
            return BadRequest(new { message = "Thông tin loại phòng hoặc mức giá không hợp lệ." });
        if (await db.RoomTypes.AnyAsync(x => x.HomestayId == id && x.Name.ToLower() == request.Name.Trim().ToLower()))
            return Conflict(new { message = "Tên loại phòng đã tồn tại trong Homestay." });
        var baseCapacity = request.BaseCapacity ?? Math.Min(2, request.MaxAdults + request.MaxChildren);
        var maxCapacity = request.MaxCapacity ?? request.MaxAdults + request.MaxChildren;
        if (baseCapacity < 1 || maxCapacity < baseCapacity || (request.ExtraGuestFee ?? 0) < 0 || request.DepositPercent is < 0 or > 1) return BadRequest(new { message = "Cấu hình sức chứa, phụ phí hoặc tỷ lệ cọc không hợp lệ." });
        var now = DateTime.UtcNow; var roomType = new RoomType { HomestayId = id, Name = request.Name.Trim(), Description = request.Description.Trim(), BasePrice = request.BasePrice, MaxAdults = maxCapacity, MaxChildren = 0, BaseCapacity = baseCapacity, MaxCapacity = maxCapacity, ExtraGuestAllowed = request.ExtraGuestAllowed ?? false, ExtraGuestFee = request.ExtraGuestFee ?? 0, DepositPercent = request.DepositPercent ?? .3m, BedType = request.BedType.Trim(), RoomSize = request.RoomSize, Status = "Active", CreatedAt = now, UpdatedAt = now };
        db.RoomTypes.Add(roomType); await db.SaveChangesAsync(); return Ok(new { roomType.Id, message = "Đã thêm loại phòng." });
    }

    [HttpPut("{id:long}/room-types/{roomTypeId:long}")]
    public async Task<IActionResult> UpdateRoomType(long id, long roomTypeId, SaveRoomTypeRequest request)
    {
        var item = await db.RoomTypes.SingleOrDefaultAsync(r => r.Id == roomTypeId && r.HomestayId == id && r.Homestay.HostId == HostId);
        if (item is null) return NotFound(new { message = "Không tìm thấy loại phòng." });
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Description) || string.IsNullOrWhiteSpace(request.BedType) || request.BasePrice <= 0 || request.MaxAdults < 1 || request.MaxChildren < 0)
            return BadRequest(new { message = "Thông tin loại phòng hoặc mức giá không hợp lệ." });
        if (await db.RoomTypes.AnyAsync(x => x.Id != roomTypeId && x.HomestayId == id && x.Name.ToLower() == request.Name.Trim().ToLower()))
            return Conflict(new { message = "Tên loại phòng đã tồn tại trong Homestay." });
        var baseCapacity = request.BaseCapacity ?? item.BaseCapacity;
        var maxCapacity = request.MaxCapacity ?? item.MaxCapacity;
        var extraGuestFee = request.ExtraGuestFee ?? item.ExtraGuestFee;
        if (baseCapacity < 1 || maxCapacity < baseCapacity || extraGuestFee < 0 || request.DepositPercent is < 0 or > 1) return BadRequest(new { message = "Cấu hình sức chứa, phụ phí hoặc tỷ lệ cọc không hợp lệ." });
        item.Name = request.Name.Trim(); item.Description = request.Description.Trim(); item.BasePrice = request.BasePrice; item.MaxAdults = maxCapacity; item.MaxChildren = 0; item.BaseCapacity = baseCapacity; item.MaxCapacity = maxCapacity; item.ExtraGuestAllowed = request.ExtraGuestAllowed ?? item.ExtraGuestAllowed; item.ExtraGuestFee = extraGuestFee; item.DepositPercent = request.DepositPercent ?? item.DepositPercent; item.BedType = request.BedType.Trim(); item.RoomSize = request.RoomSize; item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); return Ok(new { message = "Đã cập nhật loại phòng." });
    }

    [HttpPatch("{id:long}/room-types/{roomTypeId:long}/capacity")]
    public async Task<IActionResult> UpdateCapacity(long id, long roomTypeId, SaveCapacityRequest request)
    {
        var item = await db.RoomTypes.SingleOrDefaultAsync(r => r.Id == roomTypeId && r.HomestayId == id && r.Homestay.HostId == HostId);
        if (item is null) return NotFound(new { message = "Không tìm thấy loại phòng." });
        if (request.BaseCapacity < 1 || request.MaxCapacity < request.BaseCapacity || request.ExtraGuestFee < 0 || request.ExtraChildFee < 0 || request.ChildMaxAge is < 0 or > 17)
            return BadRequest(new { message = "Sức chứa hoặc phụ phí khách thêm không hợp lệ." });
        item.BaseCapacity = request.BaseCapacity; item.MaxCapacity = request.MaxCapacity;
        item.MaxAdults = request.MaxCapacity; item.MaxChildren = 0;
        item.ExtraGuestAllowed = request.ExtraGuestAllowed; item.ExtraGuestFee = request.ExtraGuestAllowed ? request.ExtraGuestFee : 0;
        item.ExtraChildFee = request.ExtraGuestAllowed ? request.ExtraChildFee : 0; item.ChildMaxAge = request.ChildMaxAge;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật sức chứa và phụ phí khách thêm." });
    }

    [HttpPatch("{id:long}/room-types/extra-guest-policy")]
    public async Task<IActionResult> BulkExtraGuestPolicy(long id, BulkExtraGuestPolicyRequest request)
    {
        if (request.ExtraGuestFee < 0 || request.ExtraChildFee < 0 || request.ChildMaxAge is < 0 or > 17) return BadRequest(new { message = "Phụ phí hoặc độ tuổi trẻ em không hợp lệ." });
        if (!await db.Homestays.AnyAsync(h => h.Id == id && h.HostId == HostId)) return NotFound(new { message = "Không tìm thấy homestay." });
        await db.RoomTypes.Where(r => r.HomestayId == id).ExecuteUpdateAsync(setters => setters
            .SetProperty(r => r.ExtraGuestAllowed, request.ExtraGuestAllowed)
            .SetProperty(r => r.ExtraGuestFee, request.ExtraGuestAllowed ? request.ExtraGuestFee : 0)
            .SetProperty(r => r.ExtraChildFee, request.ExtraGuestAllowed ? request.ExtraChildFee : 0)
            .SetProperty(r => r.ChildMaxAge, request.ChildMaxAge)
            .SetProperty(r => r.UpdatedAt, DateTime.UtcNow));
        return Ok(new { message = "Đã áp dụng chính sách khách thêm cho tất cả loại phòng." });
    }

    [HttpDelete("{id:long}/room-types/{roomTypeId:long}")]
    public async Task<IActionResult> DeleteRoomType(long id, long roomTypeId)
    {
        var item = await db.RoomTypes.SingleOrDefaultAsync(r => r.Id == roomTypeId && r.HomestayId == id && r.Homestay.HostId == HostId);
        if (item is null) return NotFound(new { message = "Không tìm thấy loại phòng." });
        if (await db.BookingDetails.AnyAsync(x => x.RoomTypeId == roomTypeId)) return BadRequest(new { message = "Loại phòng đã có lịch sử booking nên không thể xóa. Hãy chuyển sang ngưng hoạt động." });
        db.RoomTypes.Remove(item); await db.SaveChangesAsync(); return Ok(new { message = "Đã xóa loại phòng." });
    }

    [HttpPost("{id:long}/room-types/{roomTypeId:long}/rooms")]
    public async Task<IActionResult> AddRoom(long id, long roomTypeId, SaveRoomRequest request)
    {
        if (!await db.RoomTypes.AnyAsync(r => r.Id == roomTypeId && r.HomestayId == id && r.Homestay.HostId == HostId)) return NotFound(new { message = "Không tìm thấy loại phòng." });
        if (string.IsNullOrWhiteSpace(request.RoomNumber)) return BadRequest(new { message = "Vui lòng nhập mã phòng." });
        var allowedStatuses = new[] { "Available", "Occupied", "Cleaning", "Maintenance", "Inactive" };
        if (!allowedStatuses.Contains(request.Status)) return BadRequest(new { message = "Trạng thái phòng không hợp lệ." });
        if (await db.Rooms.AnyAsync(r => r.RoomTypeId == roomTypeId && r.RoomNumber.ToLower() == request.RoomNumber.Trim().ToLower())) return Conflict(new { message = "Mã phòng đã tồn tại trong loại phòng này." });
        var now = DateTime.UtcNow; var room = new Room { RoomTypeId = roomTypeId, RoomNumber = request.RoomNumber.Trim(), FloorNumber = request.FloorNumber, Status = request.Status, Note = request.Note?.Trim(), CreatedAt = now, UpdatedAt = now }; db.Rooms.Add(room);
        await db.SaveChangesAsync(); return Ok(new { room.Id, message = "Đã thêm phòng." });
    }

    [HttpPut("{id:long}/rooms/{roomId:long}")]
    public async Task<IActionResult> UpdateRoom(long id, long roomId, SaveRoomRequest request)
    {
        var room = await db.Rooms.SingleOrDefaultAsync(r => r.Id == roomId && r.RoomType.HomestayId == id && r.RoomType.Homestay.HostId == HostId);
        if (room is null) return NotFound(new { message = "Không tìm thấy phòng." });
        if (string.IsNullOrWhiteSpace(request.RoomNumber)) return BadRequest(new { message = "Vui lòng nhập mã phòng." });
        var allowedStatuses = new[] { "Available", "Occupied", "Cleaning", "Maintenance", "Inactive" };
        if (!allowedStatuses.Contains(request.Status)) return BadRequest(new { message = "Trạng thái phòng không hợp lệ." });
        if (await db.Rooms.AnyAsync(r => r.Id != roomId && r.RoomTypeId == room.RoomTypeId && r.RoomNumber.ToLower() == request.RoomNumber.Trim().ToLower())) return Conflict(new { message = "Mã phòng đã tồn tại trong loại phòng này." });
        if (request.Status is "Maintenance" or "Inactive" && await db.BookingDetails.AnyAsync(x => x.RoomId == roomId && x.Booking.CheckOutDate > BookingRules.Today && ((x.Booking.Status == BookingStatus.Hold && x.Booking.HoldExpiresAt > DateTime.UtcNow) || BookingRules.ReservedStatuses.Contains(x.Booking.Status))))
            return Conflict(new { message = "Phòng có booking hiệu lực; hãy xử lý booking trước khi bảo trì hoặc ngưng phòng." });
        room.RoomNumber = request.RoomNumber.Trim(); room.FloorNumber = request.FloorNumber; room.Status = request.Status; room.Note = request.Note?.Trim(); room.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); return Ok(new { message = "Đã cập nhật trạng thái phòng." });
    }

    [HttpDelete("{id:long}/rooms/{roomId:long}")]
    public async Task<IActionResult> DeleteRoom(long id, long roomId)
    {
        var room = await db.Rooms.SingleOrDefaultAsync(r => r.Id == roomId && r.RoomType.HomestayId == id && r.RoomType.Homestay.HostId == HostId);
        if (room is null) return NotFound(new { message = "Không tìm thấy phòng." });
        if (await db.BookingDetails.AnyAsync(x => x.RoomId == roomId)) return BadRequest(new { message = "Phòng đã có lịch sử đặt phòng nên không thể xóa. Hãy chuyển sang trạng thái bảo trì." });
        db.Rooms.Remove(room); await db.SaveChangesAsync(); return Ok(new { message = "Đã xóa phòng." });
    }

    [HttpPost("{id:long}/rooms/{roomId:long}/images")]
    public async Task<IActionResult> AddRoomImage(long id, long roomId, SaveImageRequest request)
    {
        if (!await db.Rooms.AnyAsync(r => r.Id == roomId && r.RoomType.HomestayId == id && r.RoomType.Homestay.HostId == HostId)) return NotFound(new { message = "Không tìm thấy phòng." });
        if (!Uri.TryCreate(request.ImageUrl?.Trim(), UriKind.Absolute, out var imageUri) || imageUri.Scheme is not ("http" or "https")) return BadRequest(new { message = "Đường dẫn ảnh phòng không hợp lệ." });
        if (request.IsThumbnail) await db.RoomImages.Where(x => x.RoomId == roomId).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsThumbnail, false));
        var image = new RoomImage { RoomId = roomId, ImageUrl = request.ImageUrl.Trim(), Caption = request.Caption?.Trim(), IsThumbnail = request.IsThumbnail, SortOrder = await db.RoomImages.CountAsync(x => x.RoomId == roomId), CreatedAt = DateTime.UtcNow };
        db.RoomImages.Add(image); await db.SaveChangesAsync(); return Ok(new { image.Id, message = "Đã thêm ảnh riêng cho phòng." });
    }

    [HttpPost("{id:long}/rooms/{roomId:long}/images/upload")]
    [RequestSizeLimit(80_000_000)]
    public async Task<IActionResult> UploadRoomImages(long id, long roomId, [FromForm] List<IFormFile> files, CancellationToken cancellationToken)
    {
        if (!await db.Rooms.AnyAsync(r => r.Id == roomId && r.RoomType.HomestayId == id && r.RoomType.Homestay.HostId == HostId, cancellationToken)) return NotFound(new { message = "Không tìm thấy phòng." });
        if (files.Count is < 1 or > 10) return BadRequest(new { message = "Mỗi lần tải từ 1 đến 10 ảnh." });
        var allowed = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase){{".jpg","image/jpeg"},{".jpeg","image/jpeg"},{".png","image/png"},{".webp","image/webp"}};
        if (files.Any(f => f.Length is <= 0 or > 8_000_000 || !allowed.TryGetValue(Path.GetExtension(f.FileName), out var type) || !string.Equals(type,f.ContentType,StringComparison.OrdinalIgnoreCase))) return BadRequest(new { message = "Chỉ nhận JPG, PNG, WEBP dưới 8 MB." });
        var urls = new List<string>();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var hasImage = await db.RoomImages.AnyAsync(x=>x.RoomId==roomId,cancellationToken);
            var sort = await db.RoomImages.CountAsync(x=>x.RoomId==roomId,cancellationToken);
            foreach(var file in files)
            {
                var extension=Path.GetExtension(file.FileName).ToLowerInvariant();
                await using var stream=file.OpenReadStream();
                var url=await storage.UploadPublicImageAsync(stream,$"hosts/{HostId}/rooms/{roomId}/{Guid.NewGuid():N}{extension}",allowed[extension],cancellationToken);
                urls.Add(url); db.RoomImages.Add(new RoomImage{RoomId=roomId,ImageUrl=url,Caption=$"Ảnh phòng",IsThumbnail=!hasImage&&urls.Count==1,SortOrder=sort++,CreatedAt=DateTime.UtcNow});
            }
            await db.SaveChangesAsync(cancellationToken); await transaction.CommitAsync(cancellationToken);
            return Ok(new { count=urls.Count, message=$"Đã tải lên {urls.Count} ảnh phòng." });
        }
        catch
        {
            await transaction.RollbackAsync(CancellationToken.None);
            foreach(var url in urls) try{await storage.DeletePublicImageIfManagedAsync(url,CancellationToken.None);}catch{/* best effort compensation */}
            throw;
        }
    }

    [HttpDelete("{id:long}/rooms/{roomId:long}/images/{imageId:long}")]
    public async Task<IActionResult> DeleteRoomImage(long id, long roomId, long imageId)
    {
        var image = await db.RoomImages.SingleOrDefaultAsync(x => x.Id == imageId && x.RoomId == roomId && x.Room.RoomType.HomestayId == id && x.Room.RoomType.Homestay.HostId == HostId);
        if (image is null) return NotFound(new { message = "Không tìm thấy ảnh phòng." });
        await storage.DeletePublicImageIfManagedAsync(image.ImageUrl, HttpContext.RequestAborted);
        db.RoomImages.Remove(image); await db.SaveChangesAsync(); return Ok(new { message = "Đã xóa ảnh phòng." });
    }

    [HttpPost("{id:long}/room-types/{roomTypeId:long}/prices")]
    public async Task<IActionResult> AddPrice(long id, long roomTypeId, SavePricePeriodRequest request)
    {
        if (request.EndDate < request.StartDate || request.PricePerNight <= 0) return BadRequest(new { message = "Khoảng ngày hoặc mức giá không hợp lệ." });
        if (!await db.RoomTypes.AnyAsync(r => r.Id == roomTypeId && r.HomestayId == id && r.Homestay.HostId == HostId)) return NotFound(new { message = "Không tìm thấy loại phòng." });
        var overlaps = await db.RoomPricePeriods.AnyAsync(x => x.RoomTypeId == roomTypeId && x.StartDate <= request.EndDate && x.EndDate >= request.StartDate);
        if (overlaps) return BadRequest(new { message = "Khoảng ngày này đang trùng với một chính sách giá khác." });
        db.RoomPricePeriods.Add(new RoomPricePeriod { RoomTypeId = roomTypeId, Name = request.Name.Trim(), StartDate = request.StartDate, EndDate = request.EndDate, PricePerNight = request.PricePerNight, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync(); return Ok(new { message = "Đã thêm giá linh động." });
    }

    [HttpDelete("{id:long}/room-types/{roomTypeId:long}/prices/{priceId:long}")]
    public async Task<IActionResult> DeletePrice(long id, long roomTypeId, long priceId)
    {
        var price = await db.RoomPricePeriods.SingleOrDefaultAsync(x => x.Id == priceId && x.RoomTypeId == roomTypeId && x.RoomType.HomestayId == id && x.RoomType.Homestay.HostId == HostId);
        if (price is null) return NotFound(new { message = "Không tìm thấy chính sách giá." });
        db.RoomPricePeriods.Remove(price); await db.SaveChangesAsync(); return Ok(new { message = "Đã xóa chính sách giá." });
    }

    #if false
    [HttpGet("amenities")]
    public async Task<IActionResult> Amenities() => Ok(new { items = await db.Amenities.AsNoTracking().OrderBy(x => x.Category).ThenBy(x => x.Name).ToListAsync() });

    [HttpGet("{id:long}")]
    public async Task<IActionResult> Detail(long id)
    {
        var item = await db.Homestays.AsNoTracking().Where(h => h.Id == id && h.HostId == HostId)
            .Select(h => new {
                h.Id, h.Name, h.Description, h.AddressLine, h.Ward, h.District, h.Province,
                h.CheckInTime, h.CheckOutTime, h.Status,
                Amenities = h.HomestayAmenities.Select(x => new { x.AmenityId, x.Amenity.Name, x.Amenity.Category }).ToList(),
                Images = h.Images.OrderBy(x => x.SortOrder).Select(x => new { x.Id, Url = x.ImageUrl, x.Caption, x.IsThumbnail }).ToList(),
                RoomTypes = h.RoomTypes.OrderBy(x => x.BasePrice).Select(r => new {
                    r.Id, r.Name, r.Description, r.BasePrice, r.MaxAdults, r.MaxChildren, r.BedType, r.RoomSize, r.Status,
                    Rooms = r.Rooms.OrderBy(x => x.RoomNumber).Select(x => new { x.Id, x.RoomNumber, x.FloorNumber, x.Status, x.Note }).ToList()
                }).ToList()
            }).SingleOrDefaultAsync();
        return item is null ? NotFound(new { message = "Không tìm thấy homestay." }) : Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create(SaveHomestayRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Description) || string.IsNullOrWhiteSpace(request.AddressLine)
            || string.IsNullOrWhiteSpace(request.District) || string.IsNullOrWhiteSpace(request.Province))
            return BadRequest(new { message = "Vui lòng nhập đầy đủ thông tin homestay." });
        var now = DateTime.UtcNow;
        var item = new Homestay { HostId = HostId, Name = request.Name.Trim(), Description = request.Description.Trim(), AddressLine = request.AddressLine.Trim(), Ward = request.Ward?.Trim() ?? "", District = request.District.Trim(), Province = request.Province.Trim(), CheckInTime = request.CheckInTime ?? new TimeOnly(14, 0), CheckOutTime = request.CheckOutTime ?? new TimeOnly(12, 0), Status = "Draft", CreatedAt = now, UpdatedAt = now };
        db.Homestays.Add(item); await db.SaveChangesAsync();
        return Ok(new { item.Id, message = "Đã tạo bản nháp homestay." });
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, SaveHomestayRequest request)
    {
        var item = await db.Homestays.SingleOrDefaultAsync(h => h.Id == id && h.HostId == HostId);
        if (item is null) return NotFound(new { message = "Không tìm thấy homestay." });
        if (item.Status == "Pending") return BadRequest(new { message = "Không thể sửa khi Admin đang duyệt." });
        item.Name = request.Name.Trim(); item.Description = request.Description.Trim(); item.AddressLine = request.AddressLine.Trim(); item.Ward = request.Ward?.Trim() ?? ""; item.District = request.District.Trim(); item.Province = request.Province.Trim(); item.CheckInTime = request.CheckInTime ?? item.CheckInTime; item.CheckOutTime = request.CheckOutTime ?? item.CheckOutTime; item.UpdatedAt = DateTime.UtcNow;
        if (item.Status is "Approved" or "Rejected") item.Status = "Draft";
        await db.SaveChangesAsync(); return Ok(new { message = "Đã cập nhật. Hãy gửi lại để Admin duyệt niêm yết." });
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var item = await db.Homestays.SingleOrDefaultAsync(h => h.Id == id && h.HostId == HostId);
        if (item is null) return NotFound(new { message = "Không tìm thấy homestay." });
        if (item.Status is not ("Draft" or "Rejected")) return BadRequest(new { message = "Chỉ có thể xóa bản nháp hoặc hồ sơ bị từ chối." });
        db.Homestays.Remove(item); await db.SaveChangesAsync(); return Ok(new { message = "Đã xóa homestay." });
    }

    [HttpPut("{id:long}/amenities")]
    public async Task<IActionResult> SaveAmenities(long id, SaveAmenitiesRequest request)
    {
        if (!await db.Homestays.AnyAsync(h => h.Id == id && h.HostId == HostId)) return NotFound(new { message = "Không tìm thấy homestay." });
        var old = db.HomestayAmenities.Where(x => x.HomestayId == id); db.HomestayAmenities.RemoveRange(old);
        var validIds = await db.Amenities.Where(x => request.AmenityIds.Contains(x.Id)).Select(x => x.Id).ToListAsync();
        db.HomestayAmenities.AddRange(validIds.Distinct().Select(x => new HomestayAmenity { HomestayId = id, AmenityId = x }));
        await db.SaveChangesAsync(); return Ok(new { message = "Đã cập nhật tiện ích." });
    }

    [HttpPost("{id:long}/images")]
    public async Task<IActionResult> AddImage(long id, SaveImageRequest request)
    {
        if (!await db.Homestays.AnyAsync(h => h.Id == id && h.HostId == HostId)) return NotFound(new { message = "Không tìm thấy homestay." });
        if (request.IsThumbnail) await db.HomestayImages.Where(x => x.HomestayId == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsThumbnail, false));
        var image = new HomestayImage { HomestayId = id, ImageUrl = request.ImageUrl.Trim(), Caption = request.Caption?.Trim(), IsThumbnail = request.IsThumbnail, SortOrder = await db.HomestayImages.CountAsync(x => x.HomestayId == id), CreatedAt = DateTime.UtcNow };
        db.HomestayImages.Add(image); await db.SaveChangesAsync(); return Ok(new { message = "Đã thêm hình ảnh." });
    }

    [HttpDelete("{id:long}/images/{imageId:long}")]
    public async Task<IActionResult> DeleteImage(long id, long imageId)
    {
        var image = await db.HomestayImages.SingleOrDefaultAsync(x => x.Id == imageId && x.HomestayId == id && x.Homestay.HostId == HostId);
        if (image is null) return NotFound(new { message = "Không tìm thấy ảnh." });
        db.HomestayImages.Remove(image); await db.SaveChangesAsync(); return Ok(new { message = "Đã xóa ảnh." });
    }

    [HttpPost("{id:long}/room-types")]
    public async Task<IActionResult> AddRoomType(long id, SaveRoomTypeRequest request)
    {
        if (!await db.Homestays.AnyAsync(h => h.Id == id && h.HostId == HostId)) return NotFound(new { message = "Không tìm thấy homestay." });
        var now = DateTime.UtcNow; var roomType = new RoomType { HomestayId = id, Name = request.Name.Trim(), Description = request.Description.Trim(), BasePrice = request.BasePrice, MaxAdults = request.MaxAdults, MaxChildren = request.MaxChildren, BedType = request.BedType.Trim(), RoomSize = request.RoomSize, Status = "Active", CreatedAt = now, UpdatedAt = now };
        db.RoomTypes.Add(roomType); await db.SaveChangesAsync(); return Ok(new { roomType.Id, message = "Đã thêm loại phòng." });
    }

    [HttpPut("{id:long}/room-types/{roomTypeId:long}")]
    public async Task<IActionResult> UpdateRoomType(long id, long roomTypeId, SaveRoomTypeRequest request)
    {
        var item = await db.RoomTypes.SingleOrDefaultAsync(r => r.Id == roomTypeId && r.HomestayId == id && r.Homestay.HostId == HostId);
        if (item is null) return NotFound(new { message = "Không tìm thấy loại phòng." });
        item.Name = request.Name.Trim(); item.Description = request.Description.Trim(); item.BasePrice = request.BasePrice; item.MaxAdults = request.MaxAdults; item.MaxChildren = request.MaxChildren; item.BedType = request.BedType.Trim(); item.RoomSize = request.RoomSize; item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); return Ok(new { message = "Đã cập nhật loại phòng." });
    }

    [HttpDelete("{id:long}/room-types/{roomTypeId:long}")]
    public async Task<IActionResult> DeleteRoomType(long id, long roomTypeId)
    {
        var item = await db.RoomTypes.SingleOrDefaultAsync(r => r.Id == roomTypeId && r.HomestayId == id && r.Homestay.HostId == HostId);
        if (item is null) return NotFound(new { message = "Không tìm thấy loại phòng." });
        db.RoomTypes.Remove(item); await db.SaveChangesAsync(); return Ok(new { message = "Đã xóa loại phòng." });
    }

    [HttpPost("{id:long}/room-types/{roomTypeId:long}/rooms")]
    public async Task<IActionResult> AddRoom(long id, long roomTypeId, SaveRoomRequest request)
    {
        if (!await db.RoomTypes.AnyAsync(r => r.Id == roomTypeId && r.HomestayId == id && r.Homestay.HostId == HostId)) return NotFound(new { message = "Không tìm thấy loại phòng." });
        var now = DateTime.UtcNow; var room = new Room { RoomTypeId = roomTypeId, RoomNumber = request.RoomNumber.Trim(), FloorNumber = request.FloorNumber, Status = request.Status, Note = request.Note?.Trim(), CreatedAt = now, UpdatedAt = now };
        db.Rooms.Add(room); await db.SaveChangesAsync(); return Ok(new { message = "Đã thêm phòng." });
    }

    [HttpPut("{id:long}/rooms/{roomId:long}")]
    public async Task<IActionResult> UpdateRoom(long id, long roomId, SaveRoomRequest request)
    {
        var room = await db.Rooms.SingleOrDefaultAsync(r => r.Id == roomId && r.RoomType.HomestayId == id && r.RoomType.Homestay.HostId == HostId);
        if (room is null) return NotFound(new { message = "Không tìm thấy phòng." });
        room.RoomNumber = request.RoomNumber.Trim(); room.FloorNumber = request.FloorNumber; room.Status = request.Status; room.Note = request.Note?.Trim(); room.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); return Ok(new { message = "Đã cập nhật trạng thái phòng." });
    }

    [HttpDelete("{id:long}/rooms/{roomId:long}")]
    public async Task<IActionResult> DeleteRoom(long id, long roomId)
    {
        var room = await db.Rooms.SingleOrDefaultAsync(r => r.Id == roomId && r.RoomType.HomestayId == id && r.RoomType.Homestay.HostId == HostId);
        if (room is null) return NotFound(new { message = "Không tìm thấy phòng." });
        db.Rooms.Remove(room); await db.SaveChangesAsync(); return Ok(new { message = "Đã xóa phòng." });
    }

    #endif
    [HttpGet("overview")]
    public async Task<IActionResult> Overview()
    {
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var homestayIds = db.Homestays.Where(h => h.HostId == hostId).Select(h => h.Id);
        return Ok(new {
            homestays = await homestayIds.CountAsync(),
            pendingHomestays = await db.Homestays.CountAsync(h => h.HostId == hostId && h.Status == "Pending"),
            bookings = await db.Bookings.CountAsync(b => homestayIds.Contains(b.HomestayId)),
            confirmedBookings = await db.Bookings.CountAsync(b => homestayIds.Contains(b.HomestayId) && b.Status == "Confirmed"),
            revenue = await db.Payments.Where(p => homestayIds.Contains(p.Booking.HomestayId) && p.Status == "Success" && p.TransactionType != "Refund").SumAsync(p => (decimal?)p.Amount) ?? 0,
            averageRating = await db.Reviews.Where(r => homestayIds.Contains(r.HomestayId) && r.Status == "Visible").AverageAsync(r => (double?)r.Rating) ?? 0
        });
    }

    [HttpGet("bookings")]
    public async Task<IActionResult> Bookings()
    {
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var items = await db.Bookings.AsNoTracking().Where(b => db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == hostId))
            .OrderByDescending(b => b.CreatedAt).Select(b => new {
                b.Id, b.BookingCode, b.HomestayId,
                HomestayName = db.Homestays.Where(h => h.Id == b.HomestayId).Select(h => h.Name).First(),
                CustomerName = db.Users.Where(u => u.Id == b.CustomerId).Select(u => u.FullName).First(),
                CustomerEmail = db.Users.Where(u => u.Id == b.CustomerId).Select(u => u.Email).First(),
                CustomerPhone = db.Users.Where(u => u.Id == b.CustomerId).Select(u => u.PhoneNumber).FirstOrDefault(),
                b.CheckInDate, b.CheckOutDate, Nights = b.Details.Select(d => (int?)d.NumberOfNights).FirstOrDefault() ?? 0,
                b.AdultCount, b.ChildCount, b.Subtotal, b.DiscountAmount, b.ServiceFee, b.TaxAmount, b.TotalAmount,
                b.Status, b.CustomerNote, b.HostNote, b.HostViewedAt, b.CreatedAt, b.UpdatedAt,
                IsNew = b.HostViewedAt == null,
                Details = b.Details.Select(d => new { d.Id, d.RoomTypeId, RoomTypeName = db.RoomTypes.Where(r => r.Id == d.RoomTypeId).Select(r => r.Name).First(),
                    d.RoomId, RoomNumber = d.RoomId == null ? null : db.Rooms.Where(r => r.Id == d.RoomId).Select(r => r.RoomNumber).FirstOrDefault(),
                    d.Quantity, d.PricePerNight, d.NumberOfNights, d.ExtraFee, d.LineTotal }).ToList(),
                Rooms = b.Details.Where(d => d.RoomId != null).Select(d => db.Rooms.Where(r => r.Id == d.RoomId).Select(r => r.RoomNumber).First()).ToList(),
                PaidAmount = b.Payments.Where(p => p.TransactionType != "Refund" && p.Status == "Success").Sum(p => (decimal?)p.Amount) ?? 0,
                Payments = b.Payments.OrderByDescending(p => p.CreatedAt).Select(p => new { p.Id, p.TransactionCode, p.PaymentMethod,
                    p.TransactionType, p.Amount, p.Status, p.PaidAt, p.CreatedAt }).ToList(),
                Cancellation = db.Cancellations.Where(c => c.BookingId == b.Id).Select(c => new { c.Id, c.Reason, c.CancellationFee, c.RefundAmount,
                    Status = c.Status == "Approved" && db.Payments.Any(p => p.BookingId == b.Id && p.TransactionType == "Refund" && p.Status == "Pending") ? "RefundPending" : c.Status,
                    c.CancelledAt, c.ProcessedAt }).FirstOrDefault()
            }).ToListAsync();
        return Ok(new { items });
    }

    [HttpPatch("bookings/{bookingId:long}/viewed")]
    public async Task<IActionResult> MarkBookingViewed(long bookingId)
    {
        var booking = await db.Bookings.SingleOrDefaultAsync(b => b.Id == bookingId
            && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy booking." });
        booking.HostViewedAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã đánh dấu đơn đã xem." });
    }

    [HttpPatch("bookings/{bookingId:long}/note")]
    public async Task<IActionResult> UpdateBookingNote(long bookingId, HostBookingNoteRequest request)
    {
        var note = request.Note?.Trim();
        if (note?.Length > 1000) return BadRequest(new { message = "Ghi chú nội bộ tối đa 1000 ký tự." });
        var booking = await db.Bookings.SingleOrDefaultAsync(b => b.Id == bookingId
            && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy booking." });
        booking.HostNote = string.IsNullOrWhiteSpace(note) ? null : note;
        booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã lưu ghi chú nội bộ." });
    }

    [HttpPost("bookings/{bookingId:long}/offline-payment")]
    public async Task<IActionResult> ConfirmOfflinePayment(long bookingId, HostOfflinePaymentRequest request)
    {
        var method = request.Method?.Trim();
        if (method is not ("Cash" or "BankTransfer")) return BadRequest(new { message = "Phương thức thanh toán không hợp lệ." });
        await using var transaction = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var booking = await db.Bookings.SingleOrDefaultAsync(b => b.Id == bookingId
            && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy booking." });
        var now = DateTime.UtcNow;
        var paymentCreatedAt = await db.Payments
            .Where(p => p.BookingId == bookingId && p.Status == "Pending")
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => (DateTime?)p.CreatedAt)
            .FirstOrDefaultAsync() ?? booking.UpdatedAt;
        if (!BookingRules.CanConfirm(booking.Status, booking.HoldExpiresAt ?? booking.UpdatedAt, paymentCreatedAt, now))
            return BadRequest(new { message = "Đơn đã hết thời gian giữ phòng hoặc không thể xác nhận thanh toán." });
        if (await db.Payments.AnyAsync(p => p.BookingId == bookingId && p.TransactionType == "Deposit" && p.Status == "Success"))
            return Conflict(new { message = "Đơn đã có giao dịch thanh toán thành công." });
        await db.Payments.Where(p => p.BookingId == bookingId && p.TransactionType == "Deposit" && p.Status == "Pending")
            .ExecuteUpdateAsync(update => update.SetProperty(p => p.Status, "Failed").SetProperty(p => p.UpdatedAt, now));
        db.Payments.Add(new Payment { BookingId = booking.Id, TransactionCode = $"OFF{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant(),
            PaymentMethod = method, TransactionType = "Deposit", Amount = booking.DepositAmount, Status = "Success",
            PaidAt = now, GatewayResponse = "Host confirmed offline payment", CreatedAt = now, UpdatedAt = now });
        booking.Status = BookingStatus.Confirmed; booking.PaymentStatus = PaymentStatus.Deposited;
        booking.UpdatedAt = now;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { message = "Đã xác nhận tiền cọc và giữ phòng cho khách.", amount = booking.DepositAmount });
    }

    [HttpPatch("bookings/{bookingId:long}/status")]
    public async Task<IActionResult> UpdateBookingStatus(long bookingId, HostBookingStatusRequest request)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var booking = await db.Bookings.Include(x => x.Details)
            .SingleOrDefaultAsync(x => x.Id == bookingId && db.Homestays.Any(h => h.Id == x.HomestayId && h.HostId == hostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy booking." });
        var target = request.Status?.Trim();
        var valid = (booking.Status, target) switch
        {
            (BookingStatus.Confirmed, BookingStatus.CheckedIn) => true,
            _ => false
        };
        if (!valid) return BadRequest(new { message = $"Không thể chuyển booking từ {booking.Status} sang {target}." });
        var today = BookingRules.Today;
        if (target == "CheckedIn" && (today < booking.CheckInDate || today >= booking.CheckOutDate))
            return BadRequest(new { message = "Chỉ nhận phòng trong khoảng ngày lưu trú của đơn." });

        var roomIds = booking.Details.Where(x => x.RoomId.HasValue).Select(x => x.RoomId!.Value).ToList();
        if (target == "CheckedIn" && await db.Rooms.AnyAsync(r => roomIds.Contains(r.Id) && r.Status != "Available"))
            return Conflict(new { message = "Phòng chưa sẵn sàng. Vui lòng kiểm tra vệ sinh và khách đang lưu trú." });
        if (target == "CheckedIn")
            await db.Rooms.Where(x => roomIds.Contains(x.Id)).ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "Occupied").SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
        booking.Status = target!;
        booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { message = "Đã nhận phòng cho khách." });
    }

    [HttpPatch("bookings/{bookingId:long}/cancellation")]
    public async Task<IActionResult> DecideCancellation(long bookingId, HostCancellationDecisionRequest request)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var booking = await db.Bookings.SingleOrDefaultAsync(x => x.Id == bookingId && x.Status == "CancellationRequested"
            && db.Homestays.Any(h => h.Id == x.HomestayId && h.HostId == hostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy yêu cầu hủy đang chờ xử lý." });
        var cancellation = await db.Cancellations.SingleAsync(x => x.BookingId == bookingId && x.Status == "Requested");
        var now = DateTime.UtcNow;
        cancellation.ProcessedBy = hostId;
        cancellation.ProcessedAt = now;
        if (!request.Approve)
        {
            cancellation.Status = "Rejected";
            booking.Status = "Confirmed";
            booking.UpdatedAt = now;
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new { message = "Đã từ chối yêu cầu hủy; booking vẫn được xác nhận." });
        }

        cancellation.Status = "Approved";
        booking.Status = "Cancelled";
        booking.UpdatedAt = now;
        if (cancellation.RefundAmount > 0)
            db.Payments.Add(new Payment { BookingId = booking.Id, TransactionCode = $"RF{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant(), PaymentMethod = "VNPay", TransactionType = "Refund", Amount = cancellation.RefundAmount, Status = "Pending", GatewayResponse = "Host approved; awaiting VNPay refund processing", CreatedAt = now, UpdatedAt = now });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { message = cancellation.RefundAmount > 0 ? "Đã duyệt hủy. Khoản hoàn tiền đang chờ xử lý qua VNPay." : "Đã duyệt hủy booking.", cancellation.RefundAmount, cancellation.CancellationFee, status = cancellation.RefundAmount > 0 ? "RefundPending" : cancellation.Status });
    }

    [HttpPost("{id:long}/submit")]
    public async Task<IActionResult> Submit(long id)
    {
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var item = await db.Homestays.SingleOrDefaultAsync(h => h.Id == id && h.HostId == hostId);
        if (item is null) return NotFound(new { message = "Không tìm thấy homestay." });
        if (item.Status is not ("Draft" or "Rejected")) return BadRequest(new { message = "Homestay không ở trạng thái có thể gửi duyệt." });
        var hasImage = await db.HomestayImages.AnyAsync(x => x.HomestayId == id);
        var hasRoom = await db.Rooms.AnyAsync(x => x.RoomType.HomestayId == id);
        if (!hasImage || !hasRoom) return BadRequest(new { message = "Cần ít nhất một ảnh Homestay và một phòng trước khi gửi Admin duyệt." });
        item.Status = "Pending"; item.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync();
        return Ok(new { message = "Đã gửi homestay chờ Admin duyệt." });
    }
}
