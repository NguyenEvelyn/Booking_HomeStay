using HomestayAuth.Api.Features.Bookings;
using System.Security.Claims;
using System.Text.Json;
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
public sealed record RoomCleaningRequest(string Action, bool LinenChanged = false, bool BathroomCleaned = false,
    bool AmenitiesRestocked = false, bool EquipmentChecked = false, string? Note = null);
public sealed record HostTimingAdjustmentRequest(string? CheckInTime, string? CheckOutTime, decimal? EarlyCheckInFee, decimal? LateCheckoutFee, string? Note);

public sealed record HostActualGuestsRequest(
    int Adults = 0,
    int ChildUnder2 = 0,
    int Child2To6 = 0,
    int Child6To10 = 0,
    int Child10To12 = 0,
    int ChildOver12 = 0
);

public sealed record HostExtraItemRequest(
    string Name,
    int Quantity,
    decimal UnitPrice,
    int Nights = 1
);

public sealed record HostCheckInRequest(
    string? GuestIdentityNumber,
    string? CustomerPhone,
    string? CheckInTime,
    decimal? EarlyCheckInFee,
    decimal? PropertyDeposit = null,
    HostActualGuestsRequest? ActualGuests = null,
    decimal? ExtraGuestFee = null,
    int? PetCount = null,
    decimal? PetFee = null,
    List<HostExtraItemRequest>? ExtraItems = null,
    string? Note = null
);

public sealed record HostAddChargeRequest(string Type, string Description, int Quantity, decimal UnitPrice);
public sealed record HostExtendStayRequest(DateOnly NewCheckOutDate, decimal? CustomNightlyRate = null, string? Reason = null);
public sealed record HostRoomChangeRequest(long NewRoomId, string? Reason, bool ApplyDifference = true, decimal? CustomPriceDifference = null, bool IsHomestayFault = false);
public sealed record HostCalculateExtensionRequest(DateOnly NewCheckOutDate, decimal? CustomNightlyRate = null);
public sealed record HostCalculateDateChangeRequest(DateOnly NewCheckInDate, DateOnly NewCheckOutDate, decimal? CustomFee = null);
public sealed record HostChangeDatesRequest(DateOnly NewCheckInDate, DateOnly NewCheckOutDate, decimal? CustomFee = null, string? Reason = null);
public sealed record HostCancelBookingRequest(string? Reason = null, decimal? OverrideRefundAmount = null, decimal? OverrideCancellationFee = null);
public sealed record HostCheckoutDamageItem(string Name, int Quantity, decimal UnitPrice);
public sealed record HostCheckoutRequest(
    string PaymentMethod,
    decimal PaymentAmount,
    decimal RefundAmount,
    string? CheckOutTime,
    decimal? LateCheckoutFee,
    decimal? PropertyDepositRefund = null,
    List<HostCheckoutDamageItem>? DamageItems = null,
    string? Note = null
);

[ApiController]
[Route("api/host/homestays")]
[Authorize(Roles = "Host")]
public sealed class HostHomestaysController(IHomestayQueryService service, AppDbContext db, SupabaseStorageService storage, RoomInventoryService roomInventory, VnPayService vnPay) : ControllerBase
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
            .Select(r => new { r.Id, r.RoomNumber, r.FloorNumber, r.Status, r.Note, r.CleaningStatus, r.CleaningStartedAt, r.CleaningCompletedAt, RoomTypeId = r.RoomTypeId, RoomTypeName = r.RoomType.Name,
                HomestayId = r.RoomType.HomestayId, HomestayName = r.RoomType.Homestay.Name, r.RoomType.MaxAdults, r.RoomType.MaxChildren,
                r.RoomType.BaseCapacity, r.RoomType.MaxCapacity, r.RoomType.ExtraGuestAllowed,
                NextBooking = db.BookingRoomStays.Where(s => s.RoomId == r.Id && s.Status == "Active" && s.StartDate >= BookingRules.Today)
                    .OrderBy(s => s.StartDate).Select(s => new { s.BookingId, s.Booking.BookingCode, CheckInDate = s.StartDate }).FirstOrDefault(),
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
        if (baseCapacity < 1 || maxCapacity < baseCapacity || maxCapacity > request.MaxAdults + request.MaxChildren || (request.ExtraGuestFee ?? 0) < 0 || request.DepositPercent is < 0 or > 1) return BadRequest(new { message = "Cấu hình sức chứa, phụ phí hoặc tỷ lệ cọc không hợp lệ." });
        var now = DateTime.UtcNow; var roomType = new RoomType { HomestayId = id, Name = request.Name.Trim(), Description = request.Description.Trim(), BasePrice = request.BasePrice, MaxAdults = request.MaxAdults, MaxChildren = request.MaxChildren, BaseCapacity = baseCapacity, MaxCapacity = maxCapacity, ExtraGuestAllowed = request.ExtraGuestAllowed ?? false, ExtraGuestFee = request.ExtraGuestFee ?? 0, DepositPercent = request.DepositPercent ?? .3m, BedType = request.BedType.Trim(), RoomSize = request.RoomSize, Status = "Active", CreatedAt = now, UpdatedAt = now };
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
        if (baseCapacity < 1 || maxCapacity < baseCapacity || maxCapacity > request.MaxAdults + request.MaxChildren || extraGuestFee < 0 || request.DepositPercent is < 0 or > 1) return BadRequest(new { message = "Cấu hình sức chứa, phụ phí hoặc tỷ lệ cọc không hợp lệ." });
        item.Name = request.Name.Trim(); item.Description = request.Description.Trim(); item.BasePrice = request.BasePrice; item.MaxAdults = request.MaxAdults; item.MaxChildren = request.MaxChildren; item.BaseCapacity = baseCapacity; item.MaxCapacity = maxCapacity; item.ExtraGuestAllowed = request.ExtraGuestAllowed ?? item.ExtraGuestAllowed; item.ExtraGuestFee = extraGuestFee; item.DepositPercent = request.DepositPercent ?? item.DepositPercent; item.BedType = request.BedType.Trim(); item.RoomSize = request.RoomSize; item.UpdatedAt = DateTime.UtcNow;
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
        var now = DateTime.UtcNow; var room = new Room { RoomTypeId = roomTypeId, RoomNumber = request.RoomNumber.Trim(), FloorNumber = request.FloorNumber, Status = request.Status, CleaningStatus = request.Status == "Cleaning" ? "NeedCleaning" : "Clean", Note = request.Note?.Trim(), CreatedAt = now, UpdatedAt = now }; db.Rooms.Add(room);
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
        var oldStatus = room.Status;
        room.RoomNumber = request.RoomNumber.Trim(); room.FloorNumber = request.FloorNumber; room.Status = request.Status; room.Note = request.Note?.Trim(); room.UpdatedAt = DateTime.UtcNow;
        if (request.Status == "Cleaning" && oldStatus != "Cleaning")
        {
            room.CleaningStatus = "NeedCleaning"; room.CleaningStartedAt = null; room.CleaningCompletedAt = null; room.CleaningChecklistJson = null;
        }
        else if (request.Status == "Available") room.CleaningStatus = "Clean";
        await db.SaveChangesAsync(); return Ok(new { message = "Đã cập nhật trạng thái phòng." });
    }

    [HttpPost("{id:long}/rooms/{roomId:long}/cleaning")]
    public async Task<IActionResult> UpdateRoomCleaning(long id, long roomId, RoomCleaningRequest request)
    {
        var room = await db.Rooms.SingleOrDefaultAsync(r => r.Id == roomId && r.RoomType.HomestayId == id && r.RoomType.Homestay.HostId == HostId);
        if (room is null) return NotFound(new { message = "Không tìm thấy phòng." });
        var now = DateTime.UtcNow;
        if (request.Action == "start")
        {
            if (room.Status != "Cleaning") return Conflict(new { message = "Chỉ có thể bắt đầu dọn khi phòng đang chờ vệ sinh." });
            room.CleaningStatus = "InProgress"; room.CleaningStartedAt = now; room.CleaningCompletedAt = null;
            room.CleaningChecklistJson = null; room.UpdatedAt = now;
        }
        else if (request.Action == "complete")
        {
            if (room.CleaningStatus != "InProgress") return Conflict(new { message = "Hãy bắt đầu dọn phòng trước khi xác nhận hoàn tất." });
            if (!request.LinenChanged || !request.BathroomCleaned || !request.AmenitiesRestocked || !request.EquipmentChecked)
                return BadRequest(new { message = "Vui lòng hoàn tất toàn bộ checklist vệ sinh." });
            room.CleaningStatus = "Clean"; room.CleaningCompletedAt = now; room.Status = "Available";
            room.CleaningChecklistJson = JsonSerializer.Serialize(new { request.LinenChanged, request.BathroomCleaned, request.AmenitiesRestocked, request.EquipmentChecked, note = request.Note?.Trim(), completedBy = HostId });
            room.UpdatedAt = now;
        }
        else return BadRequest(new { message = "Thao tác vệ sinh không hợp lệ." });
        await db.SaveChangesAsync();
        return Ok(new { message = request.Action == "start" ? $"Đã bắt đầu dọn phòng {room.RoomNumber}." : $"Phòng {room.RoomNumber} đã sạch và sẵn sàng đón khách." });
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
    public async Task<IActionResult> Bookings([FromQuery] string sort = "checkin_asc")
    {
        var hostId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var today = BookingRules.Today;
        var upcomingStatuses = new[] { "Confirmed", "PendingPayment", "Pending", "Hold" };
        var query = db.Bookings.AsNoTracking().Where(b => db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == hostId));
        query = sort switch
        {
            "created_desc" => query.OrderByDescending(b => b.CreatedAt),
            "checkout_asc" => query.OrderBy(b => b.CheckOutDate).ThenBy(b => b.CheckInDate),
            "amount_desc" => query.OrderByDescending(b => b.TotalAmount).ThenBy(b => b.CheckInDate),
            _ => query
                .OrderBy(b => upcomingStatuses.Contains(b.Status) && b.CheckInDate < today ? 0
                    : (b.Status == "CheckedIn" || b.Status == "CheckoutPendingPayment") ? 1
                    : upcomingStatuses.Contains(b.Status) && b.CheckInDate >= today ? 2
                    : (b.Status == "Completed" || b.Status == "CheckedOut") ? 3
                    : (b.Status == "Cancelled" || b.Status == "NoShow" || b.Status == "Expired") ? 4 : 3)
                .ThenBy(b => upcomingStatuses.Contains(b.Status) && b.CheckInDate < today ? b.CheckInDate
                    : (b.Status == "CheckedIn" || b.Status == "CheckoutPendingPayment") ? b.CheckOutDate : b.CheckInDate)
                .ThenByDescending(b => b.CreatedAt)
        };
        var rawItems = await query.Select(b => new {
                b.Id, b.BookingCode, b.HomestayId,
                HomestayName = db.Homestays.Where(h => h.Id == b.HomestayId).Select(h => h.Name).First(),
                CustomerName = b.ContactName ?? db.Users.Where(u => u.Id == b.CustomerId).Select(u => u.FullName).First(),
                CustomerEmail = b.ContactEmail ?? db.Users.Where(u => u.Id == b.CustomerId).Select(u => u.Email).First(),
                CustomerPhone = b.ContactPhone ?? db.Users.Where(u => u.Id == b.CustomerId).Select(u => u.PhoneNumber).FirstOrDefault(),
                GuestName = b.GuestName ?? b.Guests.Where(g => g.IsPrimary).Select(g => g.FullName).FirstOrDefault() ?? b.ContactName ?? db.Users.Where(u => u.Id == b.CustomerId).Select(u => u.FullName).First(),
                b.CheckInDate, b.CheckOutDate, Nights = b.Details.Select(d => (int?)d.NumberOfNights).FirstOrDefault() ?? 0,
                b.AdultCount, b.ChildCount, b.RoomAmount, b.DepositAmount, b.Subtotal, b.DiscountAmount, b.ServiceFee, b.TaxAmount, b.TotalAmount,
                b.Status, b.CustomerNote, b.HostNote, b.HostViewedAt, b.CreatedAt, b.UpdatedAt,
                b.PricingSnapshotJson,
                b.PolicySnapshotJson,
                HomestayPolicyJson = db.HomestayPolicies.Where(p => p.HomestayId == b.HomestayId && p.Status == "Active").OrderByDescending(p => p.Version).Select(p => p.OperationalPolicyJson).FirstOrDefault(),
                IsNew = b.HostViewedAt == null,
                ContactIsNew = b.ContactUpdatedAt != null && (b.HostViewedAt == null || b.ContactUpdatedAt > b.HostViewedAt),
                CheckInOut = db.CheckInOuts.Where(c => c.BookingId == b.Id).Select(c => new {
                    c.Id, c.GuestIdentityNumber, c.ActualCheckInAt, c.ActualCheckOutAt, c.Status, c.Note,
                    PropertyDeposit = c.DepositAmount, c.AdditionalCharge,
                    c.CheckedInBy, c.CheckedOutBy,
                    CheckedInByName = c.CheckedInBy == null ? null : db.Users.Where(u => u.Id == c.CheckedInBy).Select(u => u.FullName).FirstOrDefault(),
                    CheckedOutByName = c.CheckedOutBy == null ? null : db.Users.Where(u => u.Id == c.CheckedOutBy).Select(u => u.FullName).FirstOrDefault()
                }).FirstOrDefault(),
                Details = b.Details.Select(d => new {
                    d.Id, d.RoomTypeId,
                    RoomTypeName = db.RoomTypes.Where(r => r.Id == d.RoomTypeId).Select(r => r.Name).First(),
                    d.RoomId,
                    RoomNumber = d.RoomId == null ? null : db.Rooms.Where(r => r.Id == d.RoomId).Select(r => r.RoomNumber).FirstOrDefault(),
                    d.Quantity, d.PricePerNight, d.NumberOfNights, d.ExtraFee, d.LineTotal,
                    Capacity = db.RoomTypes.Where(r => r.Id == d.RoomTypeId).Select(r => new {
                        r.BaseCapacity,
                        r.MaxCapacity,
                        r.MaxAdults,
                        r.MaxChildren,
                        r.ExtraGuestAllowed,
                        r.ExtraGuestFee,
                        r.ExtraChildFee,
                        r.ChildMaxAge,
                        r.BasePrice
                    }).FirstOrDefault()
                }).ToList(),
                Rooms = b.Details.Where(d => d.RoomId != null).Select(d => db.Rooms.Where(r => r.Id == d.RoomId).Select(r => r.RoomNumber).First()).ToList(),
                AdditionalCharges = b.AdditionalCharges.OrderBy(c => c.CreatedAt).Select(c => new {
                    c.Id, c.Type, c.Description, c.Quantity, c.UnitPrice, c.TotalPrice, c.Status, c.IsPaid, c.CreatedAt
                }).ToList(),
                PaidAmount = b.Payments.Where(p => p.TransactionType != "Refund" && p.Status == "Success").Sum(p => (decimal?)p.Amount) ?? 0,
                Payments = b.Payments.OrderByDescending(p => p.CreatedAt).Select(p => new { p.Id, p.TransactionCode, p.PaymentMethod,
                    p.TransactionType, p.Amount, p.Status, p.PaidAt, p.CreatedAt }).ToList(),
                Cancellation = db.Cancellations.Where(c => c.BookingId == b.Id).Select(c => new { c.Id, c.Reason, c.CancellationFee, c.RefundAmount,
                    Status = c.Status == "Approved" && db.Payments.Any(p => p.BookingId == b.Id && p.TransactionType == "Refund" && p.Status == "Pending") ? "RefundPending" : c.Status,
                    c.CancelledAt, c.ProcessedAt }).FirstOrDefault(),
                RoomChangeLogs = db.RoomChangeLogs.Where(c => c.BookingId == b.Id).OrderByDescending(c => c.CreatedAt).Select(c => new {
                    c.Id, c.OldRoomId,
                    OldRoomNumber = db.Rooms.Where(r => r.Id == c.OldRoomId).Select(r => r.RoomNumber).FirstOrDefault(),
                    c.NewRoomId,
                    NewRoomNumber = db.Rooms.Where(r => r.Id == c.NewRoomId).Select(r => r.RoomNumber).FirstOrDefault(),
                    c.ChangeDate, c.RemainingNights, c.PriceDifference, c.InitiatedBy, c.Reason, c.CreatedAt
                }).ToList(),
                DateChanges = db.BookingDateChanges.Where(d => d.BookingId == b.Id).OrderByDescending(d => d.CreatedAt).Select(d => new {
                    d.Id, d.OldCheckInDate, d.OldCheckOutDate, d.NewCheckInDate, d.NewCheckOutDate, d.DaysBeforeCheckIn, d.DateChangeFee, d.PriceDifference, d.TotalAmountDifference, d.Reason, d.CreatedAt
                }).ToList(),
                Extensions = db.BookingExtensions.Where(e => e.BookingId == b.Id).OrderByDescending(e => e.CreatedAt).Select(e => new {
                    e.Id, e.OldCheckOutDate, e.NewCheckOutDate, e.ExtendedNights, e.TotalCost, e.Reason, e.CreatedAt
                }).ToList()
            }).ToListAsync();

        var bookingIds = rawItems.Select(x => x.Id.ToString()).ToList();
        var auditLogs = await db.AuditLogs.AsNoTracking()
            .Where(a => a.TargetType == "Booking" && bookingIds.Contains(a.TargetId))
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new {
                a.Id, a.TargetId, a.ActorId, a.ActorRole, a.Action, a.BeforeJson, a.AfterJson, a.Reason, a.CreatedAt
            })
            .ToListAsync();

        var actorIds = auditLogs.Select(a => a.ActorId).Distinct().ToList();
        var userMap = await db.Users.AsNoTracking()
            .Where(u => actorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName);

        var items = rawItems.Select(b => {
            var policy = ResolvePolicyForBooking(b.PolicySnapshotJson, b.HomestayPolicyJson);
            var pricingSnapshot = ResolvePricingSnapshot(
                b.PricingSnapshotJson,
                b.CheckInDate,
                b.CheckOutDate,
                b.RoomAmount,
                b.Nights,
                b.DiscountAmount,
                b.AdultCount,
                b.ChildCount,
                policy);

            var daysUntilCheckIn = b.CheckInDate.DayNumber - today.DayNumber;
            var urgencyLevel = !upcomingStatuses.Contains(b.Status) ? "normal"
                : daysUntilCheckIn < 0 ? "overdue"
                : daysUntilCheckIn == 0 ? "today"
                : daysUntilCheckIn == 1 ? "tomorrow"
                : daysUntilCheckIn <= 7 ? "soon" : "normal";

            return new {
                b.Id, b.BookingCode, b.HomestayId, b.HomestayName, b.CustomerName, b.CustomerEmail, b.CustomerPhone, b.GuestName, b.ContactIsNew,
                CustomerCountry = "Việt Nam",
                b.CheckInDate, b.CheckOutDate, b.Nights, b.AdultCount, b.ChildCount, b.RoomAmount, b.DepositAmount,
                b.Subtotal, b.DiscountAmount, b.ServiceFee, b.TaxAmount, b.TotalAmount, b.Status, b.CustomerNote,
                b.HostNote, b.HostViewedAt, b.CreatedAt, b.UpdatedAt, b.IsNew, b.CheckInOut, b.Details, b.Rooms,
                b.AdditionalCharges, b.PaidAmount, b.Payments, b.Cancellation,
                b.RoomChangeLogs, b.DateChanges, b.Extensions,
                DaysUntilCheckin = daysUntilCheckIn,
                UrgencyLevel = urgencyLevel,
                Policy = policy,
                PricingSnapshot = pricingSnapshot,
                AuditLogs = auditLogs.Where(a => a.TargetId == b.Id.ToString()).Select(a => new {
                    a.Id,
                    a.TargetId,
                    a.ActorId,
                    ActorName = (a.ActorId.HasValue && userMap.TryGetValue(a.ActorId.Value, out var name)) ? name : a.ActorRole,
                    a.ActorRole,
                    a.Action,
                    a.BeforeJson,
                    a.AfterJson,
                    a.Reason,
                    a.CreatedAt
                }).ToList()
            };
        });

        return Ok(new { items });
    }

    private static object ResolvePricingSnapshot(
        string? pricingSnapshotJson,
        DateOnly checkIn,
        DateOnly checkOut,
        decimal roomAmount,
        int nights,
        decimal discountAmount,
        int adultCount,
        int childCount,
        OperationalPolicyDocument policy)
    {
        var nightsList = new List<object>();
        decimal baseRoomAmount = roomAmount;
        decimal seasonalSurcharge = 0m;
        string? promoCode = null;
        bool parsedBreakdown = false;

        if (!string.IsNullOrWhiteSpace(pricingSnapshotJson) && pricingSnapshotJson != "{}")
        {
            try
            {
                using var doc = JsonDocument.Parse(pricingSnapshotJson);
                var root = doc.RootElement;
                if (root.TryGetProperty("price", out var priceEl))
                {
                    if (priceEl.TryGetProperty("nightsBreakdown", out var nbEl) && nbEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in nbEl.EnumerateArray())
                        {
                            var dateStr = item.TryGetProperty("date", out var d) ? d.GetString() ?? "" : "";
                            var basePrice = item.TryGetProperty("basePrice", out var bp) ? bp.GetDecimal() : 0m;
                            var surchargeCode = item.TryGetProperty("surchargeCode", out var sc) ? sc.GetString() : null;
                            var surchargePercent = item.TryGetProperty("surchargePercent", out var sp) ? sp.GetDecimal() : 0m;
                            var finalPrice = item.TryGetProperty("finalPrice", out var fp) ? fp.GetDecimal() : basePrice;
                            var reason = surchargePercent > 0 ? (surchargeCode == "weekend" ? "+10% cuối tuần" : $"+{surchargePercent}% ngày cao điểm") : null;
                            nightsList.Add(new {
                                date = dateStr,
                                basePrice,
                                surchargeCode,
                                surchargePercent,
                                finalPrice,
                                surchargeReason = reason
                            });
                        }
                        parsedBreakdown = nightsList.Count > 0;
                    }
                    if (priceEl.TryGetProperty("promotionCode", out var pc)) promoCode = pc.GetString();
                    if (priceEl.TryGetProperty("baseRoomAmount", out var bra)) baseRoomAmount = bra.GetDecimal();
                    if (priceEl.TryGetProperty("seasonalSurchargeAmount", out var ssa)) seasonalSurcharge = ssa.GetDecimal();
                }
            }
            catch { }
        }

        if (!parsedBreakdown)
        {
            var effectiveNights = Math.Max(1, nights > 0 ? nights : (checkOut.DayNumber - checkIn.DayNumber));
            var nightlyPrice = Math.Round(roomAmount / effectiveNights);
            for (var d = checkIn; d < checkOut; d = d.AddDays(1))
            {
                var isWeekend = d.DayOfWeek == DayOfWeek.Friday || d.DayOfWeek == DayOfWeek.Saturday;
                var surchargePercent = isWeekend ? 10m : 0m;
                var final = isWeekend ? Math.Round(nightlyPrice * 1.1m) : nightlyPrice;
                nightsList.Add(new {
                    date = d.ToString("yyyy-MM-dd"),
                    basePrice = nightlyPrice,
                    surchargeCode = isWeekend ? "weekend" : (string?)null,
                    surchargePercent,
                    finalPrice = final,
                    surchargeReason = isWeekend ? "+10% cuối tuần" : (string?)null
                });
            }
        }

        return new {
            originalRoomAmount = roomAmount,
            baseRoomAmount,
            discountAmount,
            seasonalSurchargeAmount = seasonalSurcharge,
            promotionCode = promoCode,
            initialAdultCount = adultCount,
            initialChildCount = childCount,
            nightsBreakdown = nightsList
        };
    }

    private static OperationalPolicyDocument ResolvePolicyForBooking(string? snapshotJson, string? homestayPolicyJson)
    {
        if (!string.IsNullOrWhiteSpace(snapshotJson) && snapshotJson != "{}")
        {
            try
            {
                var snapshot = PolicyService.ParseSnapshot(snapshotJson);
                if (snapshot.Document != null) return snapshot.Document;
            }
            catch { }
        }
        if (!string.IsNullOrWhiteSpace(homestayPolicyJson) && homestayPolicyJson != "{}")
        {
            try
            {
                return PolicyService.ParseDocument(homestayPolicyJson);
            }
            catch { }
        }
        return OperationalPolicyDocument.SunriseGardenDefault();
    }

    private async Task LogAudit(string action, long bookingId, string? beforeJson, string? afterJson, string? reason)
    {
        try
        {
            db.AuditLogs.Add(new AuditLog
            {
                ActorId = HostId,
                ActorRole = "Host",
                Action = action,
                TargetType = "Booking",
                TargetId = bookingId.ToString(),
                BeforeJson = beforeJson,
                AfterJson = afterJson,
                Reason = reason,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }
        catch
        {
            // Ignore audit log error if any
        }
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
        var oldNote = booking.HostNote;
        booking.HostNote = string.IsNullOrWhiteSpace(note) ? null : note;
        booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await LogAudit("UpdateNote", bookingId,
            $"{{\"note\": \"{oldNote?.Replace("\"", "\\\"")}\"}}",
            $"{{\"note\": \"{note?.Replace("\"", "\\\"")}\"}}",
            "Cập nhật ghi chú nội bộ cho Host");
        return Ok(new { message = "Đã lưu ghi chú nội bộ.", hostNote = booking.HostNote, updatedAt = booking.UpdatedAt });
    }

    [HttpPost("bookings/{bookingId:long}/adjust-timing")]
    public async Task<IActionResult> AdjustBookingTiming(long bookingId, HostTimingAdjustmentRequest request)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var booking = await db.Bookings
            .Include(x => x.AdditionalCharges)
            .Include(x => x.Payments)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy booking." });

        var now = DateTime.UtcNow;

        // Xử lý Phụ thu nhận phòng sớm (Early Check-in)
        var existingEarly = booking.AdditionalCharges.FirstOrDefault(c => c.Type == "early_checkin");
        if (request.EarlyCheckInFee.HasValue && request.EarlyCheckInFee.Value > 0)
        {
            var desc = $"Phụ thu nhận phòng sớm (Giờ check-in: {request.CheckInTime ?? "sớm"})";
            if (existingEarly is not null)
            {
                existingEarly.UnitPrice = request.EarlyCheckInFee.Value;
                existingEarly.TotalPrice = request.EarlyCheckInFee.Value;
                existingEarly.Description = desc;
                existingEarly.Status = "Approved";
            }
            else
            {
                db.AdditionalCharges.Add(new AdditionalCharge
                {
                    BookingId = booking.Id,
                    Type = "early_checkin",
                    Description = desc,
                    Quantity = 1,
                    UnitPrice = request.EarlyCheckInFee.Value,
                    TotalPrice = request.EarlyCheckInFee.Value,
                    Status = "Approved",
                    RecordedBy = HostId,
                    CreatedAt = now
                });
            }
        }
        else if (existingEarly is not null)
        {
            db.AdditionalCharges.Remove(existingEarly);
        }

        // Xử lý Phụ thu trả phòng muộn (Late Check-out)
        var existingLate = booking.AdditionalCharges.FirstOrDefault(c => c.Type == "late_checkout");
        if (request.LateCheckoutFee.HasValue && request.LateCheckoutFee.Value > 0)
        {
            var desc = $"Phụ thu trả phòng muộn (Giờ check-out: {request.CheckOutTime ?? "muộn"})";
            if (existingLate is not null)
            {
                existingLate.UnitPrice = request.LateCheckoutFee.Value;
                existingLate.TotalPrice = request.LateCheckoutFee.Value;
                existingLate.Description = desc;
                existingLate.Status = "Approved";
            }
            else
            {
                db.AdditionalCharges.Add(new AdditionalCharge
                {
                    BookingId = booking.Id,
                    Type = "late_checkout",
                    Description = desc,
                    Quantity = 1,
                    UnitPrice = request.LateCheckoutFee.Value,
                    TotalPrice = request.LateCheckoutFee.Value,
                    Status = "Approved",
                    RecordedBy = HostId,
                    CreatedAt = now
                });
            }
        }
        else if (existingLate is not null)
        {
            db.AdditionalCharges.Remove(existingLate);
        }

        await db.SaveChangesAsync();

        var approvedCharges = await db.AdditionalCharges
            .Where(x => x.BookingId == bookingId && (x.Status == "Approved" || x.Status == "Adjusted" || x.Status == "Paid"))
            .SumAsync(x => (decimal?)x.TotalPrice) ?? 0;

        booking.Subtotal = booking.RoomAmount + approvedCharges;
        booking.TotalAmount = Math.Max(0, booking.Subtotal - booking.DiscountAmount + booking.ServiceFee + booking.TaxAmount);

        if (!string.IsNullOrWhiteSpace(request.Note))
        {
            booking.HostNote = string.IsNullOrWhiteSpace(booking.HostNote)
                ? request.Note.Trim()
                : $"{booking.HostNote}\n{request.Note.Trim()}";
        }

        booking.UpdatedAt = now;
        await db.SaveChangesAsync();
        await tx.CommitAsync();

        var chargesList = await db.AdditionalCharges
            .Where(x => x.BookingId == bookingId)
            .OrderBy(x => x.CreatedAt)
            .Select(c => new {
                c.Id, c.Type, c.Description, c.Quantity, c.UnitPrice, c.TotalPrice, c.Status, c.IsPaid, c.CreatedAt
            }).ToListAsync();

        return Ok(new
        {
            booking.Id,
            booking.RoomAmount,
            booking.Subtotal,
            booking.TotalAmount,
            paidAmount = booking.Payments.Where(p => p.TransactionType != "Refund" && p.Status == "Success").Sum(p => p.Amount),
            additionalCharges = chargesList,
            message = "Đã cập nhật giờ nhận/trả phòng và tính lại hóa đơn."
        });
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

    [HttpPost("bookings/{bookingId:long}/check-in")]
    public async Task<IActionResult> CheckInBooking(long bookingId, HostCheckInRequest request)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var booking = await db.Bookings
            .Include(b => b.Details)
            .Include(b => b.AdditionalCharges)
            .Include(b => b.Payments)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        if (booking.Status != BookingStatus.Confirmed && booking.Status != BookingStatus.CheckedIn)
            return BadRequest(new { message = "Chỉ có thể check-in cho đơn ở trạng thái 'Đã xác nhận'." });

        var now = DateTime.UtcNow;

        // Cập nhật số điện thoại nếu khách cập nhật/đối chiếu
        if (!string.IsNullOrWhiteSpace(request.CustomerPhone))
        {
            var user = await db.Users.FindAsync(booking.CustomerId);
            if (user != null && string.IsNullOrWhiteSpace(user.PhoneNumber))
            {
                user.PhoneNumber = request.CustomerPhone.Trim();
                user.UpdatedAt = now;
            }
        }

        // 1. Xử lý Phụ thu nhận phòng sớm (Early Check-in)
        var existingEarly = booking.AdditionalCharges.FirstOrDefault(c => c.Type == "early_checkin");
        if (request.EarlyCheckInFee.HasValue && request.EarlyCheckInFee.Value > 0)
        {
            var desc = $"Phụ thu nhận phòng sớm (Giờ check-in: {request.CheckInTime ?? "sớm"})";
            if (existingEarly is not null)
            {
                existingEarly.UnitPrice = request.EarlyCheckInFee.Value;
                existingEarly.TotalPrice = request.EarlyCheckInFee.Value;
                existingEarly.Description = desc;
                existingEarly.Status = "Approved";
            }
            else
            {
                db.AdditionalCharges.Add(new AdditionalCharge
                {
                    BookingId = booking.Id,
                    Type = "early_checkin",
                    Description = desc,
                    Quantity = 1,
                    UnitPrice = request.EarlyCheckInFee.Value,
                    TotalPrice = request.EarlyCheckInFee.Value,
                    Status = "Approved",
                    RecordedBy = HostId,
                    CreatedAt = now
                });
            }
        }
        else if (existingEarly is not null)
        {
            db.AdditionalCharges.Remove(existingEarly);
        }

        // 2. Xử lý Phụ thu thêm khách thực tế (Module I)
        var existingGuestCharge = booking.AdditionalCharges.FirstOrDefault(c => c.Type == "extra_guest");
        if (request.ExtraGuestFee.HasValue && request.ExtraGuestFee.Value > 0)
        {
            var g = request.ActualGuests;
            var desc = g != null
                ? $"Phụ thu thêm khách ({g.Adults} người lớn, {g.ChildUnder2 + g.Child2To6 + g.Child6To10 + g.Child10To12 + g.ChildOver12} trẻ em)"
                : "Phụ thu vượt số lượng khách tiêu chuẩn";
            if (existingGuestCharge is not null)
            {
                existingGuestCharge.UnitPrice = request.ExtraGuestFee.Value;
                existingGuestCharge.TotalPrice = request.ExtraGuestFee.Value;
                existingGuestCharge.Description = desc;
                existingGuestCharge.Status = "Approved";
            }
            else
            {
                db.AdditionalCharges.Add(new AdditionalCharge
                {
                    BookingId = booking.Id,
                    Type = "extra_guest",
                    Description = desc,
                    Quantity = 1,
                    UnitPrice = request.ExtraGuestFee.Value,
                    TotalPrice = request.ExtraGuestFee.Value,
                    Status = "Approved",
                    RecordedBy = HostId,
                    CreatedAt = now
                });
            }
        }
        else if (existingGuestCharge is not null)
        {
            db.AdditionalCharges.Remove(existingGuestCharge);
        }

        // 3. Xử lý Phụ phí thú cưng (Module IV)
        var existingPet = booking.AdditionalCharges.FirstOrDefault(c => c.Type == "pet");
        if (request.PetFee.HasValue && request.PetFee.Value > 0)
        {
            var petCount = request.PetCount ?? 1;
            var desc = $"Phụ phí mang theo thú cưng ({petCount} bé)";
            if (existingPet is not null)
            {
                existingPet.Quantity = petCount;
                existingPet.UnitPrice = request.PetFee.Value / petCount;
                existingPet.TotalPrice = request.PetFee.Value;
                existingPet.Description = desc;
                existingPet.Status = "Approved";
            }
            else
            {
                db.AdditionalCharges.Add(new AdditionalCharge
                {
                    BookingId = booking.Id,
                    Type = "pet",
                    Description = desc,
                    Quantity = petCount,
                    UnitPrice = request.PetFee.Value / petCount,
                    TotalPrice = request.PetFee.Value,
                    Status = "Approved",
                    RecordedBy = HostId,
                    CreatedAt = now
                });
            }
        }
        else if (existingPet is not null)
        {
            db.AdditionalCharges.Remove(existingPet);
        }

        // 4. Xử lý Giường phụ & vật dụng thêm (Module II)
        if (request.ExtraItems != null && request.ExtraItems.Count > 0)
        {
            foreach (var item in request.ExtraItems)
            {
                if (item.Quantity > 0 && item.UnitPrice > 0)
                {
                    var isBed = item.Name.Contains("giường", StringComparison.OrdinalIgnoreCase) || item.Name.Contains("nôi", StringComparison.OrdinalIgnoreCase);
                    var total = item.Quantity * item.UnitPrice * item.Nights;
                    db.AdditionalCharges.Add(new AdditionalCharge
                    {
                        BookingId = booking.Id,
                        Type = isBed ? "extra_bed" : "extra_item",
                        Description = $"{item.Name} ({item.Quantity} món × {item.Nights} đêm)",
                        Quantity = item.Quantity,
                        UnitPrice = item.UnitPrice * item.Nights,
                        TotalPrice = total,
                        Status = "Approved",
                        RecordedBy = HostId,
                        CreatedAt = now
                    });
                }
            }
        }

        await db.SaveChangesAsync();

        var approvedCharges = await db.AdditionalCharges
            .Where(x => x.BookingId == bookingId && (x.Status == "Approved" || x.Status == "Adjusted" || x.Status == "Paid"))
            .SumAsync(x => (decimal?)x.TotalPrice) ?? 0;

        booking.Subtotal = booking.RoomAmount + approvedCharges;
        booking.TotalAmount = Math.Max(0, booking.Subtotal - booking.DiscountAmount + booking.ServiceFee + booking.TaxAmount);

        // Cập nhật trạng thái các phòng đã xếp sang Occupied
        var roomIds = booking.Details.Where(x => x.RoomId.HasValue).Select(x => x.RoomId!.Value).ToList();
        if (roomIds.Count > 0)
        {
            await db.Rooms.Where(x => roomIds.Contains(x.Id))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "Occupied").SetProperty(x => x.UpdatedAt, now));
        }

        // Lưu / cập nhật bản ghi check_in_outs
        var checkInOut = await db.CheckInOuts.SingleOrDefaultAsync(c => c.BookingId == bookingId);
        var propertyDepositVal = request.PropertyDeposit ?? (checkInOut?.DepositAmount ?? 0);

        if (checkInOut is null)
        {
            checkInOut = new CheckInOut
            {
                BookingId = bookingId,
                CheckedInBy = HostId,
                ActualCheckInAt = now,
                GuestIdentityNumber = request.GuestIdentityNumber?.Trim(),
                DepositAmount = propertyDepositVal,
                AdditionalCharge = approvedCharges,
                Note = request.Note?.Trim(),
                Status = "CheckedIn"
            };
            db.CheckInOuts.Add(checkInOut);
        }
        else
        {
            checkInOut.CheckedInBy = HostId;
            checkInOut.ActualCheckInAt = now;
            if (!string.IsNullOrWhiteSpace(request.GuestIdentityNumber))
                checkInOut.GuestIdentityNumber = request.GuestIdentityNumber.Trim();
            checkInOut.DepositAmount = propertyDepositVal;
            checkInOut.AdditionalCharge = approvedCharges;
            checkInOut.Status = "CheckedIn";
            if (!string.IsNullOrWhiteSpace(request.Note))
                checkInOut.Note = request.Note.Trim();
        }

        booking.Status = BookingStatus.CheckedIn;
        booking.UpdatedAt = now;
        await db.SaveChangesAsync();

        // Ghi vết lịch sử (Audit Log)
        await LogAudit("CheckIn", bookingId,
            beforeJson: $"{{\"status\": \"Confirmed\"}}",
            afterJson: $"{{\"status\": \"CheckedIn\", \"cccd\": \"{request.GuestIdentityNumber}\", \"propertyDeposit\": {propertyDepositVal}, \"earlyFee\": {request.EarlyCheckInFee ?? 0}, \"extraGuestFee\": {request.ExtraGuestFee ?? 0}, \"totalAmount\": {booking.TotalAmount}}}",
            reason: request.Note?.Trim() ?? "Xác nhận đối chiếu và check-in khách lưu trú");

        await tx.CommitAsync();

        var chargesList = await db.AdditionalCharges
            .Where(x => x.BookingId == bookingId)
            .OrderBy(x => x.CreatedAt)
            .Select(c => new {
                c.Id, c.Type, c.Description, c.Quantity, c.UnitPrice, c.TotalPrice, c.Status, c.IsPaid, c.CreatedAt
            }).ToListAsync();

        return Ok(new
        {
            booking.Id,
            status = booking.Status,
            guestIdentityNumber = checkInOut.GuestIdentityNumber,
            actualCheckInAt = checkInOut.ActualCheckInAt,
            propertyDeposit = checkInOut.DepositAmount,
            booking.RoomAmount,
            booking.Subtotal,
            booking.TotalAmount,
            additionalCharges = chargesList,
            message = "Xác nhận đối chiếu thông tin khách và nhận phòng (Check-in) thành công!"
        });
    }

    [HttpPost("bookings/{bookingId:long}/additional-charges")]
    public async Task<IActionResult> AddBookingAdditionalCharge(long bookingId, HostAddChargeRequest request)
    {
        if (request.Quantity <= 0 || (request.Type != "custom_adjustment" && request.UnitPrice < 0) || string.IsNullOrWhiteSpace(request.Description))
            return BadRequest(new { message = "Thông tin dịch vụ/tiện ích phát sinh không hợp lệ." });

        await using var tx = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var booking = await db.Bookings
            .Include(b => b.AdditionalCharges)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        var now = DateTime.UtcNow;
        var total = request.Quantity * request.UnitPrice;
        var charge = new AdditionalCharge
        {
            BookingId = bookingId,
            Type = string.IsNullOrWhiteSpace(request.Type) ? "service" : request.Type.Trim(),
            Description = request.Description.Trim(),
            Quantity = request.Quantity,
            UnitPrice = request.UnitPrice,
            TotalPrice = total,
            Status = "Approved",
            IsPaid = false,
            RecordedBy = HostId,
            CreatedAt = now
        };
        db.AdditionalCharges.Add(charge);
        await db.SaveChangesAsync();

        var approvedCharges = await db.AdditionalCharges
            .Where(x => x.BookingId == bookingId && (x.Status == "Approved" || x.Status == "Adjusted" || x.Status == "Paid"))
            .SumAsync(x => (decimal?)x.TotalPrice) ?? 0;

        booking.Subtotal = booking.RoomAmount + approvedCharges;
        booking.TotalAmount = Math.Max(0, booking.Subtotal - booking.DiscountAmount + booking.ServiceFee + booking.TaxAmount);
        booking.UpdatedAt = now;

        var checkInOut = await db.CheckInOuts.SingleOrDefaultAsync(c => c.BookingId == bookingId);
        if (checkInOut != null)
        {
            checkInOut.AdditionalCharge = approvedCharges;
        }

        await db.SaveChangesAsync();

        await LogAudit("AddCharge", bookingId, null, $"{{\"type\": \"{charge.Type}\", \"desc\": \"{charge.Description}\", \"total\": {charge.TotalPrice}}}", charge.Description);

        await tx.CommitAsync();

        var list = await db.AdditionalCharges.Where(c => c.BookingId == bookingId).OrderBy(c => c.CreatedAt)
            .Select(c => new { c.Id, c.Type, c.Description, c.Quantity, c.UnitPrice, c.TotalPrice, c.Status, c.IsPaid, c.CreatedAt }).ToListAsync();

        return Ok(new
        {
            message = "Đã thêm tiện ích phát sinh và tự động cộng dồn vào hóa đơn.",
            booking.Subtotal,
            booking.TotalAmount,
            additionalCharges = list
        });
    }

    [HttpDelete("bookings/{bookingId:long}/additional-charges/{chargeId:long}")]
    public async Task<IActionResult> RemoveBookingAdditionalCharge(long bookingId, long chargeId)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var booking = await db.Bookings
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        var charge = await db.AdditionalCharges.SingleOrDefaultAsync(c => c.Id == chargeId && c.BookingId == bookingId);
        if (charge is null) return NotFound(new { message = "Không tìm thấy khoản phụ phí." });
        if (charge.IsPaid) return BadRequest(new { message = "Không thể xóa khoản phí đã thanh toán." });

        db.AdditionalCharges.Remove(charge);
        await db.SaveChangesAsync();

        var approvedCharges = await db.AdditionalCharges
            .Where(x => x.BookingId == bookingId && (x.Status == "Approved" || x.Status == "Adjusted" || x.Status == "Paid"))
            .SumAsync(x => (decimal?)x.TotalPrice) ?? 0;

        booking.Subtotal = booking.RoomAmount + approvedCharges;
        booking.TotalAmount = Math.Max(0, booking.Subtotal - booking.DiscountAmount + booking.ServiceFee + booking.TaxAmount);
        booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        await LogAudit("RemoveCharge", bookingId, $"{{\"chargeId\": {chargeId}, \"desc\": \"{charge.Description}\", \"total\": {charge.TotalPrice}}}", null, "Xóa khoản phụ phí");

        await tx.CommitAsync();

        var list = await db.AdditionalCharges.Where(c => c.BookingId == bookingId).OrderBy(c => c.CreatedAt)
            .Select(c => new { c.Id, c.Type, c.Description, c.Quantity, c.UnitPrice, c.TotalPrice, c.Status, c.IsPaid, c.CreatedAt }).ToListAsync();

        return Ok(new
        {
            message = "Đã xóa khoản phụ phí và cập nhật lại hóa đơn.",
            booking.Subtotal,
            booking.TotalAmount,
            additionalCharges = list
        });
    }

    [HttpGet("bookings/{bookingId:long}/available-rooms")]
    public async Task<IActionResult> GetAvailableRoomsForChange(long bookingId)
    {
        var booking = await db.Bookings.Include(b => b.Details)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        if (booking.Status is not (BookingStatus.Confirmed or BookingStatus.CheckedIn))
            return BadRequest(new { message = "Chỉ có thể đổi phòng cho đơn đã xác nhận hoặc đang lưu trú." });

        var currentRoomId = booking.Details.Select(d => d.RoomId).FirstOrDefault();
        var currentDetail = booking.Details.FirstOrDefault();
        var currentPricePerNight = currentDetail?.PricePerNight ?? 0;

        var today = BookingRules.Today;
        var changeDate = booking.Status == BookingStatus.CheckedIn ? today : booking.CheckInDate;
        if (changeDate >= booking.CheckOutDate)
            return BadRequest(new { message = "Đơn đã hết thời gian lưu trú nên không thể đổi phòng." });
        var remainingNights = booking.CheckOutDate.DayNumber - changeDate.DayNumber;
        var guestCount = booking.AdultCount + booking.ChildCount;

        // Tìm các phòng thuộc cùng Homestay
        var rooms = await db.Rooms
            .Include(r => r.RoomType)
            .Where(r => r.RoomType.HomestayId == booking.HomestayId && r.Status != "Maintenance")
            .OrderBy(r => r.RoomNumber)
            .Select(r => new
            {
                r.Id,
                r.RoomNumber,
                r.FloorNumber,
                r.Status,
                r.RoomTypeId,
                RoomTypeName = r.RoomType.Name,
                BasePrice = r.RoomType.PricePeriods
                    .Where(p => p.StartDate <= changeDate && p.EndDate >= changeDate)
                    .OrderByDescending(p => p.StartDate)
                    .Select(p => (decimal?)p.PricePerNight)
                    .FirstOrDefault() ?? r.RoomType.BasePrice,
                BaseCapacity = r.RoomType.BaseCapacity,
                MaxCapacity = r.RoomType.MaxCapacity > 0 ? r.RoomType.MaxCapacity : r.RoomType.BaseCapacity,
                IsCurrent = r.Id == currentRoomId
            })
            .ToListAsync();

        // Kiểm tra xem phòng nào bị trùng booking khác trong khoảng thời gian còn lại
        var blockedRoomIds = await db.BookingDetails
            .Where(d => d.BookingId != bookingId && d.RoomId.HasValue
                && BookingRules.ReservedStatuses.Contains(d.Booking.Status)
                && d.Booking.CheckInDate < booking.CheckOutDate
                && d.Booking.CheckOutDate > changeDate)
            .Select(d => d.RoomId!.Value)
            .Distinct()
            .ToListAsync();

        var availableRooms = rooms
            .Where(r => !r.IsCurrent
                && !blockedRoomIds.Contains(r.Id)
                && (booking.Status != BookingStatus.CheckedIn || r.Status != "Occupied")
                && r.BasePrice > 0
                && r.MaxCapacity >= guestCount)
            .Select(r =>
            {
                var diffPerNight = r.BasePrice - currentPricePerNight;
                var totalDiff = diffPerNight * remainingNights;
                return new
                {
                    r.Id,
                    r.RoomNumber,
                    r.FloorNumber,
                    r.Status,
                    r.RoomTypeId,
                    r.RoomTypeName,
                    r.BasePrice,
                    pricePerNight = r.BasePrice,
                    r.BaseCapacity,
                    r.MaxCapacity,
                    r.IsCurrent,
                    diffPerNight,
                    totalDiff,
                    priceDifference = totalDiff,
                    remainingNights
                };
            })
            .ToList();

        return Ok(new
        {
            currentRoomId,
            currentRoomNumber = rooms.FirstOrDefault(r => r.Id == currentRoomId)?.RoomNumber,
            currentPricePerNight,
            remainingNights,
            changeDate,
            guestCount,
            availableRooms
        });
    }

    [HttpPost("bookings/{bookingId:long}/change-room")]
    public async Task<IActionResult> ChangeBookingRoom(long bookingId, HostRoomChangeRequest request)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var booking = await db.Bookings
            .Include(b => b.Details)
            .Include(b => b.AdditionalCharges)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        if (booking.Status is not (BookingStatus.Confirmed or BookingStatus.CheckedIn))
            return BadRequest(new { message = "Chỉ có thể đổi phòng cho đơn đã xác nhận hoặc đang lưu trú." });

        var changeReason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(changeReason))
            return BadRequest(new { message = "Vui lòng nhập lý do đổi phòng." });

        var detail = booking.Details.FirstOrDefault();
        if (detail is null) return BadRequest(new { message = "Đơn chưa có chi tiết phòng." });

        var oldRoomId = detail.RoomId;
        var newRoom = await db.Rooms.Include(r => r.RoomType).SingleOrDefaultAsync(r => r.Id == request.NewRoomId && r.RoomType.HomestayId == booking.HomestayId);
        if (newRoom is null) return BadRequest(new { message = "Phòng mới không hợp lệ hoặc không thuộc homestay này." });

        if (oldRoomId == newRoom.Id) return BadRequest(new { message = "Phòng mới trùng với phòng hiện tại." });

        await roomInventory.LockRoom(newRoom.Id);

        if (booking.Status == BookingStatus.CheckedIn && newRoom.Status == "Occupied")
            return Conflict(new { message = $"Phòng {newRoom.RoomNumber} hiện đang có khách lưu trú." });

        var maxCap = newRoom.RoomType.MaxCapacity > 0 ? newRoom.RoomType.MaxCapacity : newRoom.RoomType.BaseCapacity;
        var totalGuests = booking.AdultCount + booking.ChildCount;
        if (totalGuests > maxCap)
        {
            return BadRequest(new { message = $"Phòng {newRoom.RoomNumber} có sức chứa tối đa {maxCap} người, không đủ cho đoàn {totalGuests} khách." });
        }

        var today = BookingRules.Today;
        var changeDate = booking.Status == BookingStatus.CheckedIn ? today : booking.CheckInDate;
        if (changeDate >= booking.CheckOutDate)
            return BadRequest(new { message = "Đơn đã hết thời gian lưu trú nên không thể đổi phòng." });

        if (!await roomInventory.IsAvailable(newRoom.Id, changeDate, booking.CheckOutDate, bookingId))
        {
            return Conflict(new { message = $"Phòng {newRoom.RoomNumber} đã có khách khác đặt trong giai đoạn này." });
        }
        var remainingNights = booking.CheckOutDate.DayNumber - changeDate.DayNumber;
        var newNightlyPrice = await db.RoomPricePeriods
            .Where(p => p.RoomTypeId == newRoom.RoomTypeId && p.StartDate <= changeDate && p.EndDate >= changeDate)
            .OrderByDescending(p => p.StartDate)
            .Select(p => (decimal?)p.PricePerNight)
            .FirstOrDefaultAsync() ?? newRoom.RoomType.BasePrice;
        if (newNightlyPrice <= 0)
            return BadRequest(new { message = $"Loại phòng {newRoom.RoomType.Name} chưa có giá hợp lệ cho ngày {changeDate:dd/MM/yyyy}." });

        var diffPerNight = newNightlyPrice - detail.PricePerNight;
        var calculatedDiff = diffPerNight * remainingNights;
        var effectiveDiff = request.ApplyDifference ? request.CustomPriceDifference ?? calculatedDiff : 0;

        // Xử lý sự cố từ phía Homestay (Homestay fault policy)
        if (request.IsHomestayFault)
        {
            var policy = ResolvePolicyForBooking(booking.PolicySnapshotJson, null);
            if (diffPerNight > 0 && policy.RoomChange.FreeUpgradeForHomestayFault)
            {
                effectiveDiff = 0; // Nâng hạng miễn phí do lỗi homestay
            }
            else if (diffPerNight < 0 && policy.RoomChange.RefundDowngradeForHomestayFault)
            {
                effectiveDiff = calculatedDiff; // Hoàn tiền giảm trừ do lỗi homestay
            }
        }

        var now = DateTime.UtcNow;

        // Chuyển trạng thái phòng cũ sang Cleaning (để dọn phòng)
        if (booking.Status == BookingStatus.CheckedIn && oldRoomId.HasValue)
        {
            await db.Rooms.Where(r => r.Id == oldRoomId.Value)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "Cleaning").SetProperty(r => r.CleaningStatus, "NeedCleaning").SetProperty(r => r.CleaningStartedAt, (DateTime?)null).SetProperty(r => r.CleaningCompletedAt, (DateTime?)null).SetProperty(r => r.UpdatedAt, now));
        }

        // Chuyển phòng mới sang Occupied nếu booking đang ở
        if (booking.Status == BookingStatus.CheckedIn)
        {
            newRoom.Status = "Occupied";
            newRoom.UpdatedAt = now;
        }

        detail.RoomId = newRoom.Id;
        detail.RoomTypeId = newRoom.RoomTypeId;

        if (oldRoomId.HasValue)
        {
            var activeStay = await db.BookingRoomStays.SingleOrDefaultAsync(x =>
                x.BookingId == bookingId && x.RoomId == oldRoomId.Value && x.Status == "Active");
            if (activeStay is not null)
            {
                activeStay.EndDate = changeDate;
                activeStay.Status = activeStay.StartDate == changeDate ? "Replaced" : "Completed";
            }
            db.BookingRoomStays.Add(new BookingRoomStay
            {
                BookingId = bookingId,
                RoomId = newRoom.Id,
                StartDate = changeDate,
                EndDate = booking.CheckOutDate,
                NightlyPrice = newNightlyPrice,
                Status = "Active",
                CreatedAt = now
            });
        }

        // Xử lý chênh lệch giá vào hóa đơn
        if (request.ApplyDifference && effectiveDiff != 0)
        {
            var desc = effectiveDiff > 0
                ? $"Phụ thu đổi/nâng hạng phòng sang {newRoom.RoomNumber} ({newRoom.RoomType.Name}) cho {remainingNights} đêm còn lại" + (request.IsHomestayFault ? " [Lỗi homestay]" : "")
                : $"Giảm trừ đổi phòng sang {newRoom.RoomNumber} ({newRoom.RoomType.Name}) cho {remainingNights} đêm còn lại" + (request.IsHomestayFault ? " [Lỗi homestay]" : "");

            db.AdditionalCharges.Add(new AdditionalCharge
            {
                BookingId = bookingId,
                Type = "room_upgrade",
                Description = desc,
                Quantity = 1,
                UnitPrice = effectiveDiff,
                TotalPrice = effectiveDiff,
                Status = "Approved",
                IsPaid = false,
                RecordedBy = HostId,
                CreatedAt = now
            });
            await db.SaveChangesAsync();

            var approvedCharges = await db.AdditionalCharges
                .Where(x => x.BookingId == bookingId && (x.Status == "Approved" || x.Status == "Adjusted" || x.Status == "Paid"))
                .SumAsync(x => (decimal?)x.TotalPrice) ?? 0;

            booking.Subtotal = booking.RoomAmount + approvedCharges;
            booking.TotalAmount = Math.Max(0, booking.Subtotal - booking.DiscountAmount + booking.ServiceFee + booking.TaxAmount);
        }

        // Ghi log vào RoomChangeLogs
        db.RoomChangeLogs.Add(new RoomChangeLog
        {
            BookingId = bookingId,
            OldRoomId = oldRoomId ?? 0,
            NewRoomId = newRoom.Id,
            ChangeDate = changeDate,
            RemainingNights = remainingNights,
            PriceDifference = effectiveDiff,
            InitiatedBy = "owner",
            RequestStatus = "Approved",
            Reason = changeReason,
            RequestedBy = HostId,
            ApprovedBy = HostId,
            DecidedAt = now,
            CreatedAt = now
        });

        booking.UpdatedAt = now;
        await db.SaveChangesAsync();

        await LogAudit("ChangeRoom", bookingId,
            beforeJson: JsonSerializer.Serialize(new { roomId = oldRoomId }),
            afterJson: JsonSerializer.Serialize(new { roomId = newRoom.Id, roomNumber = newRoom.RoomNumber, diff = effectiveDiff, homestayFault = request.IsHomestayFault }),
            reason: changeReason);

        await tx.CommitAsync();

        return Ok(new
        {
            message = $"Đã đổi thành công sang phòng {newRoom.RoomNumber} ({newRoom.RoomType.Name}).",
            newRoomId = newRoom.Id,
            newRoomNumber = newRoom.RoomNumber,
            newRoomTypeName = newRoom.RoomType.Name,
            newNightlyPrice,
            oldRoomId,
            changeDate,
            remainingNights,
            calculatedPriceDifference = calculatedDiff,
            priceDifference = effectiveDiff,
            booking.Subtotal,
            booking.TotalAmount
        });
    }

    [HttpPost("bookings/{bookingId:long}/extend-stay")]
    public async Task<IActionResult> ExtendBookingStay(long bookingId, HostExtendStayRequest request)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var booking = await db.Bookings
            .Include(b => b.Details)
            .Include(b => b.AdditionalCharges)
            .Include(b => b.Payments)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        if (booking.Status != BookingStatus.CheckedIn && booking.Status != BookingStatus.Confirmed)
            return BadRequest(new { message = "Chỉ có thể gia hạn lưu trú cho đơn đang xác nhận hoặc đang lưu trú." });

        if (request.NewCheckOutDate <= booking.CheckOutDate)
            return BadRequest(new { message = $"Ngày trả phòng mới ({request.NewCheckOutDate:dd/MM/yyyy}) phải sau ngày trả phòng hiện tại ({booking.CheckOutDate:dd/MM/yyyy})." });

        var detail = booking.Details.FirstOrDefault();
        if (detail is null) return BadRequest(new { message = "Đơn đặt phòng không có thông tin chi tiết phòng." });

        var extendedNights = request.NewCheckOutDate.DayNumber - booking.CheckOutDate.DayNumber;

        // Kiểm tra phòng hiện tại có bị khách khác đặt trong khoảng ngày gia hạn không
        if (detail.RoomId.HasValue)
        {
            await roomInventory.LockRoom(detail.RoomId.Value);
            if (!await roomInventory.IsAvailable(detail.RoomId.Value, booking.CheckOutDate, request.NewCheckOutDate, bookingId))
                return Conflict(new { message = $"Phòng hiện tại đã có khách khác đặt trong giai đoạn gia hạn ({booking.CheckOutDate:dd/MM/yyyy} - {request.NewCheckOutDate:dd/MM/yyyy}). Vui lòng đổi sang phòng trống khác trước khi gia hạn." });
        }

        // Tính giá từng đêm gia hạn theo giá niêm yết (RoomPricePeriod hoặc BasePrice)
        decimal totalExtensionCost = 0;
        var pricePeriods = await db.RoomPricePeriods
            .Where(p => p.RoomTypeId == detail.RoomTypeId && p.EndDate >= booking.CheckOutDate && p.StartDate < request.NewCheckOutDate)
            .ToListAsync();

        var roomType = await db.RoomTypes.FindAsync(detail.RoomTypeId);
        var baseRate = roomType?.BasePrice ?? detail.PricePerNight;

        for (var d = booking.CheckOutDate; d < request.NewCheckOutDate; d = d.AddDays(1))
        {
            if (request.CustomNightlyRate.HasValue && request.CustomNightlyRate.Value > 0)
            {
                totalExtensionCost += request.CustomNightlyRate.Value;
            }
            else
            {
                var period = pricePeriods.FirstOrDefault(p => p.StartDate <= d && p.EndDate >= d);
                totalExtensionCost += period?.PricePerNight ?? baseRate;
            }
        }

        var now = DateTime.UtcNow;
        var oldCheckOut = booking.CheckOutDate;
        booking.CheckOutDate = request.NewCheckOutDate;
        detail.NumberOfNights += extendedNights;
        if (detail.RoomId.HasValue)
        {
            var activeStay = await db.BookingRoomStays
                .OrderByDescending(x => x.StartDate)
                .FirstOrDefaultAsync(x => x.BookingId == bookingId && x.RoomId == detail.RoomId.Value && x.Status == "Active");
            if (activeStay is not null) activeStay.EndDate = request.NewCheckOutDate;
        }

        var desc = $"Gia hạn thêm {extendedNights} đêm ({oldCheckOut:dd/MM} -> {request.NewCheckOutDate:dd/MM/yyyy})"
            + (string.IsNullOrWhiteSpace(request.Reason) ? "" : $" ({request.Reason.Trim()})");

        db.AdditionalCharges.Add(new AdditionalCharge
        {
            BookingId = bookingId,
            Type = "stay_extension",
            Description = desc,
            Quantity = extendedNights,
            UnitPrice = decimal.Round(totalExtensionCost / extendedNights, 0, MidpointRounding.AwayFromZero),
            TotalPrice = totalExtensionCost,
            Status = "Approved",
            IsPaid = false,
            RecordedBy = HostId,
            CreatedAt = now
        });

        db.BookingExtensions.Add(new BookingExtension
        {
            BookingId = bookingId,
            OldCheckOutDate = oldCheckOut,
            NewCheckOutDate = request.NewCheckOutDate,
            ExtendedNights = extendedNights,
            TotalCost = totalExtensionCost,
            Reason = request.Reason?.Trim(),
            ExtendedBy = HostId,
            CreatedAt = now
        });
        await db.SaveChangesAsync();

        var approvedCharges = await db.AdditionalCharges
            .Where(x => x.BookingId == bookingId && (x.Status == "Approved" || x.Status == "Adjusted" || x.Status == "Paid"))
            .SumAsync(x => (decimal?)x.TotalPrice) ?? 0;

        booking.Subtotal = booking.RoomAmount + approvedCharges;
        booking.TotalAmount = Math.Max(0, booking.Subtotal - booking.DiscountAmount + booking.ServiceFee + booking.TaxAmount);
        booking.UpdatedAt = now;

        await LogAudit("ExtendStay", bookingId,
            beforeJson: JsonSerializer.Serialize(new { checkOutDate = oldCheckOut }),
            afterJson: JsonSerializer.Serialize(new { checkOutDate = request.NewCheckOutDate, extendedNights, cost = totalExtensionCost }),
            reason: request.Reason?.Trim() ?? "Gia hạn thêm số đêm lưu trú");

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        var chargesList = await db.AdditionalCharges
            .Where(x => x.BookingId == bookingId)
            .OrderBy(x => x.CreatedAt)
            .Select(c => new {
                c.Id, c.Type, c.Description, c.Quantity, c.UnitPrice, c.TotalPrice, c.Status, c.IsPaid, c.CreatedAt
            }).ToListAsync();

        return Ok(new
        {
            message = $"Đã gia hạn thành công thêm {extendedNights} đêm đến ngày {request.NewCheckOutDate:dd/MM/yyyy}!",
            newCheckOutDate = request.NewCheckOutDate,
            extendedNights,
            totalExtensionCost,
            booking.Subtotal,
            booking.TotalAmount,
            additionalCharges = chargesList
        });
    }

    [HttpPost("bookings/{bookingId:long}/calculate-extension")]
    public async Task<IActionResult> CalculateExtension(long bookingId, HostCalculateExtensionRequest request)
    {
        var booking = await db.Bookings
            .Include(b => b.Details)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        if (request.NewCheckOutDate <= booking.CheckOutDate)
            return BadRequest(new { message = $"Ngày trả phòng mới ({request.NewCheckOutDate:dd/MM/yyyy}) phải sau ngày trả phòng hiện tại ({booking.CheckOutDate:dd/MM/yyyy})." });

        var detail = booking.Details.FirstOrDefault();
        if (detail is null) return BadRequest(new { message = "Đơn không có chi tiết phòng." });

        var extendedNights = request.NewCheckOutDate.DayNumber - booking.CheckOutDate.DayNumber;

        bool hasConflict = false;
        if (detail.RoomId.HasValue)
        {
            hasConflict = await db.BookingDetails.AnyAsync(d =>
                d.BookingId != bookingId
                && d.RoomId == detail.RoomId
                && BookingRules.ReservedStatuses.Contains(d.Booking.Status)
                && d.Booking.CheckInDate < request.NewCheckOutDate
                && d.Booking.CheckOutDate > booking.CheckOutDate);
        }

        var pricePeriods = await db.RoomPricePeriods
            .Where(p => p.RoomTypeId == detail.RoomTypeId && p.EndDate >= booking.CheckOutDate && p.StartDate < request.NewCheckOutDate)
            .ToListAsync();

        var roomType = await db.RoomTypes.FindAsync(detail.RoomTypeId);
        var baseRate = roomType?.BasePrice ?? detail.PricePerNight;

        decimal totalCost = 0;
        var nightsList = new List<object>();

        for (var d = booking.CheckOutDate; d < request.NewCheckOutDate; d = d.AddDays(1))
        {
            decimal rate;
            if (request.CustomNightlyRate.HasValue && request.CustomNightlyRate.Value > 0)
            {
                rate = request.CustomNightlyRate.Value;
            }
            else
            {
                var period = pricePeriods.FirstOrDefault(p => p.StartDate <= d && p.EndDate >= d);
                rate = period?.PricePerNight ?? baseRate;
            }
            totalCost += rate;
            nightsList.Add(new { date = d.ToString("yyyy-MM-dd"), price = rate });
        }

        var paidAmount = await db.Payments
            .Where(p => p.BookingId == bookingId && p.TransactionType != "Refund" && p.Status == "Success")
            .SumAsync(p => (decimal?)p.Amount) ?? 0;
        var debtBefore = booking.TotalAmount - paidAmount;
        var debtAfter = (booking.TotalAmount + totalCost) - paidAmount;

        return Ok(new
        {
            currentCheckOutDate = booking.CheckOutDate,
            newCheckOutDate = request.NewCheckOutDate,
            extendedNights,
            totalCost,
            hasConflict,
            isAvailable = !hasConflict,
            conflictWarning = hasConflict ? "Phòng hiện tại đã có khách khác đặt trong giai đoạn gia hạn này. Vui lòng đổi sang phòng trống khác trước khi gia hạn!" : null,
            nights = nightsList,
            breakdown = nightsList,
            debtBefore,
            debtAfter
        });
    }

    [HttpPost("bookings/{bookingId:long}/calculate-date-change")]
    public async Task<IActionResult> CalculateDateChange(long bookingId, HostCalculateDateChangeRequest request)
    {
        var booking = await db.Bookings
            .Include(b => b.Details)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        if (booking.Status == BookingStatus.Cancelled || booking.Status == "CheckedOut" || booking.Status == "Completed")
            return BadRequest(new { message = "Không thể đổi ngày cho đơn đã hoàn tất hoặc đã hủy." });

        if (request.NewCheckOutDate <= request.NewCheckInDate)
            return BadRequest(new { message = "Ngày trả phòng phải sau ngày nhận phòng." });

        var detail = booking.Details.FirstOrDefault();
        if (detail is null) return BadRequest(new { message = "Đơn không có chi tiết phòng." });

        var today = BookingRules.Today;
        var daysBeforeCheckIn = Math.Max(0, booking.CheckInDate.DayNumber - today.DayNumber);

        decimal feePercent = daysBeforeCheckIn >= 7 ? 0 : (daysBeforeCheckIn >= 3 ? 10 : 20);
        decimal dateChangeFee = request.CustomFee ?? decimal.Round(booking.RoomAmount * feePercent / 100m, 0);

        bool hasConflict = false;
        if (detail.RoomId.HasValue)
        {
            hasConflict = await db.BookingDetails.AnyAsync(d =>
                d.BookingId != bookingId
                && d.RoomId == detail.RoomId
                && BookingRules.ReservedStatuses.Contains(d.Booking.Status)
                && d.Booking.CheckInDate < request.NewCheckOutDate
                && d.Booking.CheckOutDate > request.NewCheckInDate);
        }

        var pricePeriods = await db.RoomPricePeriods
            .Where(p => p.RoomTypeId == detail.RoomTypeId && p.EndDate >= request.NewCheckInDate && p.StartDate < request.NewCheckOutDate)
            .ToListAsync();

        var roomType = await db.RoomTypes.FindAsync(detail.RoomTypeId);
        var baseRate = roomType?.BasePrice ?? detail.PricePerNight;

        decimal newRoomAmount = 0;
        var nightsList = new List<object>();

        for (var d = request.NewCheckInDate; d < request.NewCheckOutDate; d = d.AddDays(1))
        {
            var period = pricePeriods.FirstOrDefault(p => p.StartDate <= d && p.EndDate >= d);
            var rate = period?.PricePerNight ?? baseRate;
            newRoomAmount += rate;
            nightsList.Add(new { date = d.ToString("yyyy-MM-dd"), price = rate });
        }

        var newNights = request.NewCheckOutDate.DayNumber - request.NewCheckInDate.DayNumber;
        var priceDifference = newRoomAmount - booking.RoomAmount;
        var totalAdjustment = priceDifference + dateChangeFee;

        var paidAmount = await db.Payments
            .Where(p => p.BookingId == bookingId && p.TransactionType != "Refund" && p.Status == "Success")
            .SumAsync(p => (decimal?)p.Amount) ?? 0;
        var debtBefore = booking.TotalAmount - paidAmount;
        var debtAfter = (booking.TotalAmount + totalAdjustment) - paidAmount;

        return Ok(new
        {
            oldCheckInDate = booking.CheckInDate,
            oldCheckOutDate = booking.CheckOutDate,
            oldRoomAmount = booking.RoomAmount,
            newCheckInDate = request.NewCheckInDate,
            newCheckOutDate = request.NewCheckOutDate,
            newNights,
            daysBeforeCheckIn,
            feePercent,
            dateChangeFee,
            calculatedDateChangeFee = dateChangeFee,
            newRoomAmount,
            priceDifference,
            totalAdjustment,
            totalAmountDifference = totalAdjustment,
            hasConflict,
            isAvailable = !hasConflict,
            conflictWarning = hasConflict ? $"Phòng hiện tại đã có khách đặt trong khoảng {request.NewCheckInDate:dd/MM} - {request.NewCheckOutDate:dd/MM/yyyy}. Vui lòng đổi phòng trống khác trước khi đổi ngày!" : null,
            nights = nightsList,
            debtBefore,
            debtAfter
        });
    }

    [HttpPost("bookings/{bookingId:long}/change-dates")]
    public async Task<IActionResult> ChangeBookingDates(long bookingId, HostChangeDatesRequest request)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var booking = await db.Bookings
            .Include(b => b.Details)
            .Include(b => b.AdditionalCharges)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        if (booking.Status == BookingStatus.Cancelled || booking.Status == "CheckedOut" || booking.Status == "Completed")
            return BadRequest(new { message = "Không thể đổi ngày cho đơn đã hoàn tất hoặc đã hủy." });

        if (request.NewCheckOutDate <= request.NewCheckInDate)
            return BadRequest(new { message = "Ngày trả phòng phải sau ngày nhận phòng." });

        var detail = booking.Details.FirstOrDefault();
        if (detail is null) return BadRequest(new { message = "Đơn không có chi tiết phòng." });

        if (detail.RoomId.HasValue)
        {
            var hasConflict = await db.BookingDetails.AnyAsync(d =>
                d.BookingId != bookingId
                && d.RoomId == detail.RoomId
                && BookingRules.ReservedStatuses.Contains(d.Booking.Status)
                && d.Booking.CheckInDate < request.NewCheckOutDate
                && d.Booking.CheckOutDate > request.NewCheckInDate);

            if (hasConflict)
                return Conflict(new { message = $"Phòng hiện tại đã có khách khác đặt trong khoảng ngày mới ({request.NewCheckInDate:dd/MM/yyyy} - {request.NewCheckOutDate:dd/MM/yyyy}). Vui lòng chọn khoảng ngày khác hoặc đổi phòng trống khác." });
        }

        var today = BookingRules.Today;
        var daysBeforeCheckIn = Math.Max(0, booking.CheckInDate.DayNumber - today.DayNumber);
        decimal feePercent = daysBeforeCheckIn >= 7 ? 0 : (daysBeforeCheckIn >= 3 ? 10 : 20);
        decimal dateChangeFee = request.CustomFee ?? decimal.Round(booking.RoomAmount * feePercent / 100m, 0);

        var pricePeriods = await db.RoomPricePeriods
            .Where(p => p.RoomTypeId == detail.RoomTypeId && p.EndDate >= request.NewCheckInDate && p.StartDate < request.NewCheckOutDate)
            .ToListAsync();

        var roomType = await db.RoomTypes.FindAsync(detail.RoomTypeId);
        var baseRate = roomType?.BasePrice ?? detail.PricePerNight;

        decimal newRoomAmount = 0;
        for (var d = request.NewCheckInDate; d < request.NewCheckOutDate; d = d.AddDays(1))
        {
            var period = pricePeriods.FirstOrDefault(p => p.StartDate <= d && p.EndDate >= d);
            newRoomAmount += period?.PricePerNight ?? baseRate;
        }

        var newNights = request.NewCheckOutDate.DayNumber - request.NewCheckInDate.DayNumber;
        var priceDifference = newRoomAmount - booking.RoomAmount;
        var totalAdjustment = priceDifference + dateChangeFee;

        var now = DateTime.UtcNow;
        var oldCheckIn = booking.CheckInDate;
        var oldCheckOut = booking.CheckOutDate;
        var oldRoomAmount = booking.RoomAmount;

        booking.CheckInDate = request.NewCheckInDate;
        booking.CheckOutDate = request.NewCheckOutDate;
        booking.RoomAmount = newRoomAmount;
        detail.NumberOfNights = newNights;
        if (newNights > 0)
        {
            detail.PricePerNight = decimal.Round(newRoomAmount / newNights, 0);
        }

        if (totalAdjustment != 0)
        {
            var desc = $"Đổi ngày lưu trú ({oldCheckIn:dd/MM} - {oldCheckOut:dd/MM} ➔ {request.NewCheckInDate:dd/MM} - {request.NewCheckOutDate:dd/MM/yyyy})"
                + $" [Chênh lệch: {(priceDifference >= 0 ? "+" : "")}{priceDifference:N0}đ"
                + (dateChangeFee > 0 ? $", Phí đổi ngày: +{dateChangeFee:N0}đ]" : "]")
                + (string.IsNullOrWhiteSpace(request.Reason) ? "" : $" - Lý do: {request.Reason.Trim()}");

            db.AdditionalCharges.Add(new AdditionalCharge
            {
                BookingId = bookingId,
                Type = "date_change",
                Description = desc,
                Quantity = 1,
                UnitPrice = totalAdjustment,
                TotalPrice = totalAdjustment,
                Status = "Approved",
                IsPaid = false,
                RecordedBy = HostId,
                CreatedAt = now
            });
        }

        db.BookingDateChanges.Add(new BookingDateChange
        {
            BookingId = bookingId,
            OldCheckInDate = oldCheckIn,
            OldCheckOutDate = oldCheckOut,
            NewCheckInDate = request.NewCheckInDate,
            NewCheckOutDate = request.NewCheckOutDate,
            DaysBeforeCheckIn = daysBeforeCheckIn,
            DateChangeFee = dateChangeFee,
            PriceDifference = priceDifference,
            TotalAmountDifference = totalAdjustment,
            Reason = request.Reason?.Trim(),
            ChangedBy = HostId,
            CreatedAt = now
        });

        await db.SaveChangesAsync();

        var approvedCharges = await db.AdditionalCharges
            .Where(x => x.BookingId == bookingId && (x.Status == "Approved" || x.Status == "Adjusted" || x.Status == "Paid"))
            .SumAsync(x => (decimal?)x.TotalPrice) ?? 0;

        booking.Subtotal = booking.RoomAmount + approvedCharges;
        booking.TotalAmount = Math.Max(0, booking.Subtotal - booking.DiscountAmount + booking.ServiceFee + booking.TaxAmount);
        booking.UpdatedAt = now;

        await LogAudit("DateChange", bookingId,
            beforeJson: $"{{\"checkIn\": \"{oldCheckIn:yyyy-MM-dd}\", \"checkOut\": \"{oldCheckOut:yyyy-MM-dd}\", \"roomAmount\": {oldRoomAmount}}}",
            afterJson: $"{{\"checkIn\": \"{request.NewCheckInDate:yyyy-MM-dd}\", \"checkOut\": \"{request.NewCheckOutDate:yyyy-MM-dd}\", \"roomAmount\": {newRoomAmount}, \"fee\": {dateChangeFee}, \"diff\": {priceDifference}}}",
            reason: request.Reason?.Trim() ?? "Đổi ngày lưu trú");

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new
        {
            message = $"Đã đổi ngày lưu trú thành công sang {request.NewCheckInDate:dd/MM/yyyy} - {request.NewCheckOutDate:dd/MM/yyyy}.",
            newCheckInDate = request.NewCheckInDate,
            newCheckOutDate = request.NewCheckOutDate,
            newNights,
            newRoomAmount,
            priceDifference,
            dateChangeFee,
            totalAdjustment,
            booking.Subtotal,
            booking.TotalAmount
        });
    }

    [HttpPost("bookings/{bookingId:long}/calculate-cancellation")]
    public async Task<IActionResult> CalculateCancellation(long bookingId)
    {
        var booking = await db.Bookings
            .Include(b => b.Payments)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        if (booking.Status == BookingStatus.Cancelled)
            return BadRequest(new { message = "Đơn đặt phòng này đã được hủy trước đó." });

        if (booking.Status == "CheckedOut" || booking.Status == "Completed")
            return BadRequest(new { message = "Không thể hủy đơn đặt phòng đã hoàn tất trả phòng." });

        bool isCheckedIn = booking.Status == BookingStatus.CheckedIn;
        var today = BookingRules.Today;
        var daysBeforeCheckIn = booking.CheckInDate.DayNumber - today.DayNumber;

        decimal refundPercent;
        string policyDesc;

        if (daysBeforeCheckIn >= 14)
        {
            refundPercent = 100;
            policyDesc = "Hủy trước check-in ≥ 14 ngày: Hoàn tiền 100% (Miễn phí hủy)";
        }
        else if (daysBeforeCheckIn >= 7)
        {
            refundPercent = 70;
            policyDesc = "Hủy trước check-in 7–13 ngày: Hoàn tiền 70% (Phí hủy 30%)";
        }
        else if (daysBeforeCheckIn >= 3)
        {
            refundPercent = 50;
            policyDesc = "Hủy trước check-in 3–6 ngày: Hoàn tiền 50% (Phí hủy 50%)";
        }
        else
        {
            refundPercent = 0;
            policyDesc = daysBeforeCheckIn < 0
                ? "Khách không đến (No-show): Không hoàn tiền (Phí hủy 100%)"
                : "Hủy trước check-in < 3 ngày: Không hoàn tiền (Phí hủy 100%)";
        }

        var paidAmount = booking.Payments
            .Where(p => p.TransactionType != "Refund" && p.Status == "Success")
            .Sum(p => (decimal?)p.Amount) ?? 0;

        var refundAmount = decimal.Round(paidAmount * refundPercent / 100m, 0);
        var cancellationFee = Math.Max(0, paidAmount - refundAmount);

        return Ok(new
        {
            bookingId,
            bookingCode = booking.BookingCode,
            status = booking.Status,
            isCheckedIn,
            checkInDate = booking.CheckInDate,
            today,
            daysBeforeCheckIn,
            policyDesc,
            refundPercent,
            cancellationFeePercent = 100 - refundPercent,
            paidAmount,
            refundAmount,
            cancellationFee,
            warning = isCheckedIn ? "Lưu ý: Khách đang lưu trú tại homestay! Không nên áp dụng quy trình hủy đơn trước check-in mà nên sử dụng chức năng Check-out trả phòng sớm." : null
        });
    }

    [HttpPost("bookings/{bookingId:long}/cancel")]
    public async Task<IActionResult> CancelBooking(long bookingId, HostCancelBookingRequest request)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var booking = await db.Bookings
            .Include(b => b.Details)
            .Include(b => b.Payments)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        if (booking.Status == BookingStatus.Cancelled)
            return BadRequest(new { message = "Đơn đặt phòng này đã được hủy trước đó." });

        if (booking.Status == "CheckedOut" || booking.Status == "Completed")
            return BadRequest(new { message = "Không thể hủy đơn đặt phòng đã hoàn tất trả phòng." });

        if (booking.Status == BookingStatus.CheckedIn)
            return BadRequest(new { message = "Khách đang lưu trú tại homestay, không thể hủy đơn theo quy trình thông thường. Vui lòng sử dụng tính năng Check-out trả phòng." });

        var today = BookingRules.Today;
        var daysBeforeCheckIn = booking.CheckInDate.DayNumber - today.DayNumber;
        decimal refundPercent = daysBeforeCheckIn >= 14 ? 100m : (daysBeforeCheckIn >= 7 ? 70m : (daysBeforeCheckIn >= 3 ? 50m : 0m));

        var paidAmount = booking.Payments
            .Where(p => p.TransactionType != "Refund" && p.Status == "Success")
            .Sum(p => (decimal?)p.Amount) ?? 0;

        var calculatedRefund = decimal.Round(paidAmount * refundPercent / 100m, 0);
        var calculatedFee = Math.Max(0, paidAmount - calculatedRefund);

        var finalRefundAmount = request.OverrideRefundAmount ?? calculatedRefund;
        var finalCancellationFee = request.OverrideCancellationFee ?? calculatedFee;

        var now = DateTime.UtcNow;
        var oldStatus = booking.Status;
        booking.Status = BookingStatus.Cancelled;
        booking.UpdatedAt = now;

        var detail = booking.Details.FirstOrDefault();
        if (detail?.RoomId.HasValue == true)
        {
            var room = await db.Rooms.FindAsync(detail.RoomId.Value);
            if (room is not null && (room.Status == "Occupied" || room.Status == "Hold"))
            {
                room.Status = "Available";
                room.UpdatedAt = now;
            }
        }

        var cancellation = await db.Cancellations.FirstOrDefaultAsync(c => c.BookingId == bookingId);
        if (cancellation is null)
        {
            db.Cancellations.Add(new Cancellation
            {
                BookingId = bookingId,
                CancelledBy = HostId,
                Reason = request.Reason?.Trim() ?? "Host thực hiện hủy đơn đặt phòng",
                CancelledAt = now,
                CancellationFee = finalCancellationFee,
                RefundAmount = finalRefundAmount,
                RefundPercent = refundPercent,
                PaidAmountAtCancellation = paidAmount,
                Status = finalRefundAmount > 0 ? "Approved" : "Cancelled",
                ProcessedBy = HostId,
                ProcessedAt = now
            });
        }
        else
        {
            cancellation.CancelledBy = HostId;
            cancellation.Reason = request.Reason?.Trim() ?? cancellation.Reason;
            cancellation.CancelledAt = now;
            cancellation.CancellationFee = finalCancellationFee;
            cancellation.RefundAmount = finalRefundAmount;
            cancellation.RefundPercent = refundPercent;
            cancellation.PaidAmountAtCancellation = paidAmount;
            cancellation.Status = finalRefundAmount > 0 ? "Approved" : "Cancelled";
            cancellation.ProcessedBy = HostId;
            cancellation.ProcessedAt = now;
        }

        if (finalRefundAmount > 0)
        {
            db.Payments.Add(new Payment
            {
                BookingId = bookingId,
                TransactionCode = $"RF{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant(),
                PaymentMethod = "BankTransfer",
                TransactionType = "Refund",
                Amount = finalRefundAmount,
                Status = "Success",
                GatewayResponse = $"Host hủy đơn đặt phòng ({daysBeforeCheckIn} ngày trước check-in). Hoàn tiền {finalRefundAmount:N0}đ (Phí hủy: {finalCancellationFee:N0}đ)",
                CreatedAt = now,
                UpdatedAt = now,
                PaidAt = now
            });
        }

        await LogAudit("CancelBooking", bookingId,
            beforeJson: $"{{\"status\": \"{oldStatus}\", \"paidAmount\": {paidAmount}}}",
            afterJson: $"{{\"status\": \"Cancelled\", \"refundAmount\": {finalRefundAmount}, \"cancellationFee\": {finalCancellationFee}, \"daysBeforeCheckIn\": {daysBeforeCheckIn}}}",
            reason: request.Reason?.Trim() ?? "Host thực hiện hủy đơn đặt phòng");

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new
        {
            message = $"Đã hủy đơn đặt phòng thành công.{(finalRefundAmount > 0 ? $" Khoản hoàn tiền {finalRefundAmount:N0}đ đã được tạo và ghi nhận." : "")}",
            status = "Cancelled",
            refundAmount = finalRefundAmount,
            cancellationFee = finalCancellationFee
        });
    }

    [HttpPost("bookings/{bookingId:long}/check-out")]
    public async Task<IActionResult> CheckOutBooking(long bookingId, HostCheckoutRequest request)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var booking = await db.Bookings
            .Include(b => b.Details)
            .Include(b => b.AdditionalCharges)
            .Include(b => b.Payments)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        if (booking.Status != BookingStatus.CheckedIn && booking.Status != BookingStatus.Confirmed && booking.Status != "CheckoutPendingPayment")
            return BadRequest(new { message = "Chỉ có thể check-out cho đơn đang lưu trú hoặc chờ thanh toán trả phòng." });

        var now = DateTime.UtcNow;

        // 1. Xử lý phụ phí trả trễ nếu có
        if (request.LateCheckoutFee.HasValue && request.LateCheckoutFee.Value > 0)
        {
            var existingLate = booking.AdditionalCharges.FirstOrDefault(c => c.Type == "late_checkout");
            var desc = $"Phụ thu trả phòng muộn (Giờ check-out: {request.CheckOutTime ?? "muộn"})";
            if (existingLate is not null)
            {
                existingLate.UnitPrice = request.LateCheckoutFee.Value;
                existingLate.TotalPrice = request.LateCheckoutFee.Value;
                existingLate.Description = desc;
                existingLate.Status = "Approved";
            }
            else
            {
                db.AdditionalCharges.Add(new AdditionalCharge
                {
                    BookingId = booking.Id,
                    Type = "late_checkout",
                    Description = desc,
                    Quantity = 1,
                    UnitPrice = request.LateCheckoutFee.Value,
                    TotalPrice = request.LateCheckoutFee.Value,
                    Status = "Approved",
                    RecordedBy = HostId,
                    CreatedAt = now
                });
            }
        }

        // 2. Xử lý bồi thường thiệt hại tài sản (Module VIII)
        if (booking.Status != BookingStatus.CheckoutPendingPayment && request.DamageItems != null && request.DamageItems.Count > 0)
        {
            foreach (var item in request.DamageItems)
            {
                if (item.Quantity > 0 && item.UnitPrice > 0)
                {
                    db.AdditionalCharges.Add(new AdditionalCharge
                    {
                        BookingId = booking.Id,
                        Type = "damage_compensation",
                        Description = $"Bồi thường tài sản: {item.Name} ({item.Quantity} món)",
                        Quantity = item.Quantity,
                        UnitPrice = item.UnitPrice,
                        TotalPrice = item.Quantity * item.UnitPrice,
                        Status = "Approved",
                        IsPaid = false,
                        RecordedBy = HostId,
                        CreatedAt = now
                    });
                }
            }
        }

        await db.SaveChangesAsync();

        var approvedCharges = await db.AdditionalCharges
            .Where(x => x.BookingId == bookingId && (x.Status == "Approved" || x.Status == "Adjusted" || x.Status == "Paid"))
            .SumAsync(x => (decimal?)x.TotalPrice) ?? 0;
        booking.Subtotal = booking.RoomAmount + approvedCharges;
        booking.TotalAmount = Math.Max(0, booking.Subtotal - booking.DiscountAmount + booking.ServiceFee + booking.TaxAmount);

        // 3. Xử lý thanh toán thêm (nếu khách còn nợ tiền phòng & dịch vụ)
        var method = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "Cash" : request.PaymentMethod.Trim();
        if (method == "BankTransfer" && request.PaymentAmount > 0)
        {
            if (!vnPay.IsConfigured)
                return StatusCode(503, new { message = "VNPay chưa được cấu hình trên máy chủ." });

            var successfulPaid = await db.Payments
                .Where(p => p.BookingId == bookingId && p.Status == "Success" && p.TransactionType != "Refund")
                .SumAsync(p => (decimal?)p.Amount) ?? 0;
            var successfulRefunded = await db.Payments
                .Where(p => p.BookingId == bookingId && p.Status == "Success" && p.TransactionType == "Refund")
                .SumAsync(p => (decimal?)p.Amount) ?? 0;
            var onlineBalance = Math.Max(0, booking.TotalAmount - successfulPaid + successfulRefunded);
            if (onlineBalance <= 0)
                return Conflict(new { message = "Đơn không còn công nợ để thanh toán qua VNPay." });

            var transactionCode = $"BAL{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant();
            await db.Payments.Where(p => p.BookingId == bookingId && p.TransactionType == "FinalPayment" && p.Status == "Pending")
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, "Failed").SetProperty(p => p.UpdatedAt, now));
            db.Payments.Add(new Payment
            {
                BookingId = booking.Id,
                TransactionCode = transactionCode,
                PaymentMethod = "VNPay",
                TransactionType = "FinalPayment",
                Amount = onlineBalance,
                Status = "Pending",
                GatewayResponse = "Awaiting VNPay checkout payment",
                CreatedAt = now,
                UpdatedAt = now
            });
            booking.Status = BookingStatus.CheckoutPendingPayment;
            booking.PaymentStatus = successfulPaid - successfulRefunded > 0 ? PaymentStatus.PartiallyPaid : PaymentStatus.Unpaid;
            booking.UpdatedAt = now;
            await db.SaveChangesAsync();

            await LogAudit("CheckoutPaymentRequested", bookingId,
                beforeJson: JsonSerializer.Serialize(new { status = BookingStatus.CheckedIn }),
                afterJson: JsonSerializer.Serialize(new { status = BookingStatus.CheckoutPendingPayment, amount = onlineBalance, paymentMethod = "VNPay" }),
                reason: request.Note?.Trim() ?? "Tạo thanh toán quyết toán qua VNPay");

            var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "127.0.0.1";
            var paymentUrl = vnPay.CreatePaymentUrl(transactionCode, onlineBalance, $"Thanh toan cong no {booking.BookingCode}", ip);
            await tx.CommitAsync();
            return Ok(new
            {
                booking.Id,
                status = booking.Status,
                paymentStatus = booking.PaymentStatus,
                requiresOnlinePayment = true,
                amount = onlineBalance,
                paymentUrl,
                message = "Đã tạo giao dịch quyết toán. Đang chuyển đến VNPay."
            });
        }

        if (request.PaymentAmount > 0)
        {
            db.Payments.Add(new Payment
            {
                BookingId = booking.Id,
                TransactionCode = $"OUT{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant(),
                PaymentMethod = method,
                TransactionType = "FinalPayment",
                Amount = request.PaymentAmount,
                Status = "Success",
                PaidAt = now,
                GatewayResponse = "Host settled checkout payment",
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        // 4. Xử lý hoàn tiền thừa (nếu cọc thừa tiền phòng)
        if (request.RefundAmount > 0)
        {
            db.Payments.Add(new Payment
            {
                BookingId = booking.Id,
                TransactionCode = $"RF{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant(),
                PaymentMethod = method,
                TransactionType = "Refund",
                Amount = request.RefundAmount,
                Status = "Success",
                PaidAt = now,
                GatewayResponse = "Host refunded excess deposit at checkout",
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        // Đánh dấu toàn bộ phụ phí là đã thanh toán
        await db.AdditionalCharges.Where(c => c.BookingId == bookingId)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsPaid, true).SetProperty(c => c.Status, "Paid"));

        // Giải phóng phòng -> chuyển sang Cleaning
        var roomIds = booking.Details.Where(x => x.RoomId.HasValue).Select(x => x.RoomId!.Value).ToList();
        if (roomIds.Count > 0)
        {
            await db.Rooms.Where(x => roomIds.Contains(x.Id))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "Cleaning").SetProperty(x => x.CleaningStatus, "NeedCleaning").SetProperty(x => x.CleaningStartedAt, (DateTime?)null).SetProperty(x => x.CleaningCompletedAt, (DateTime?)null).SetProperty(x => x.UpdatedAt, now));
        }

        // Cập nhật check_in_outs & quyết toán cọc tài sản (Module IX)
        var checkInOut = await db.CheckInOuts.SingleOrDefaultAsync(c => c.BookingId == bookingId);
        var refundDepositNote = request.PropertyDepositRefund.HasValue
            ? $"[Cọc tài sản: {checkInOut?.DepositAmount ?? 0:N0}đ | Hoàn trả: {request.PropertyDepositRefund.Value:N0}đ]"
            : "";
        var combinedNote = string.Join(" | ", new[] { checkInOut?.Note, request.Note?.Trim(), refundDepositNote }.Where(s => !string.IsNullOrWhiteSpace(s)));

        if (checkInOut is null)
        {
            checkInOut = new CheckInOut
            {
                BookingId = bookingId,
                CheckedOutBy = HostId,
                ActualCheckOutAt = now,
                Status = "CheckedOut",
                Note = combinedNote
            };
            db.CheckInOuts.Add(checkInOut);
        }
        else
        {
            checkInOut.CheckedOutBy = HostId;
            checkInOut.ActualCheckOutAt = now;
            checkInOut.Status = "CheckedOut";
            checkInOut.Note = combinedNote;
        }

        // Cập nhật trạng thái đơn sang CheckedOut (Hoàn tất)
        booking.Status = BookingStatus.CheckedOut;
        booking.PaymentStatus = PaymentStatus.Paid;
        booking.UpdatedAt = now;

        await db.SaveChangesAsync();

        await LogAudit("CheckOut", bookingId,
            beforeJson: $"{{\"status\": \"CheckedIn\"}}",
            afterJson: $"{{\"status\": \"CheckedOut\", \"paid\": {request.PaymentAmount}, \"refund\": {request.RefundAmount}, \"depositRefund\": {request.PropertyDepositRefund ?? 0}}}",
            reason: request.Note?.Trim() ?? "Hoàn tất trả phòng và quyết toán");

        await tx.CommitAsync();

        return Ok(new
        {
            booking.Id,
            status = booking.Status,
            paymentStatus = booking.PaymentStatus,
            actualCheckOutAt = checkInOut.ActualCheckOutAt,
            message = "Đã hoàn tất trả phòng (Check-out) và giải phóng phòng thành công!"
        });
    }
}

