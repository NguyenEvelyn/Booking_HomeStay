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
public sealed partial class HostHomestaysController(IHomestayQueryService service, AppDbContext db, SupabaseStorageService storage, RoomInventoryService roomInventory, VnPayService vnPay, PaymentService paymentService) : ControllerBase
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
                NextBooking = db.BookingRoomStays.Where(s => s.RoomId == r.Id && s.Status == "Active" && s.StartDate >= BookingRules.Today
                        && (BookingRules.ReservedStatuses.Contains(s.Booking.Status) || (s.Booking.Status == BookingStatus.Hold && s.Booking.HoldExpiresAt > DateTime.UtcNow)))
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
        if (!ImageUpload.IsAllowedUrl(request.ImageUrl)) return BadRequest(new { message = "Đường dẫn ảnh không hợp lệ. Hãy tải ảnh lên hoặc dùng liên kết https." });
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
        if (!ImageUpload.IsAllowedUrl(request.ImageUrl)) return BadRequest(new { message = "Đường dẫn ảnh phòng không hợp lệ." });
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
        var validated = new List<(IFormFile File, string Extension, string ContentType)>();
        foreach (var f in files)
        {
            if (await ImageUpload.Validate(f, cancellationToken) is not (var ext, var type)) return BadRequest(new { message = "Chỉ nhận JPG, PNG, WEBP dưới 8 MB." });
            validated.Add((f, ext, type));
        }
        var urls = new List<string>();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var hasImage = await db.RoomImages.AnyAsync(x=>x.RoomId==roomId,cancellationToken);
            var sort = await db.RoomImages.CountAsync(x=>x.RoomId==roomId,cancellationToken);
            foreach(var (file, extension, contentType) in validated)
            {
                await using var stream=file.OpenReadStream();
                var url=await storage.UploadPublicImageAsync(stream,$"hosts/{HostId}/rooms/{roomId}/{Guid.NewGuid():N}{extension}",contentType,cancellationToken);
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
}
