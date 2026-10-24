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

// In-stay operations: check-in, additional charges, room change, stay extension and date changes.
public sealed partial class HostHomestaysController
{
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
        // Actual party at the door: same occupancy rules as online booking. Extra adults (or too many children)
        // cannot be checked in to this room; the host must change room or add a room first.
        decimal? serverGuestFee = null;
        if (request.ActualGuests is { } actualGuests)
        {
            var (stayRoomType, stayQuantity) = await BookingRoomType(booking);
            var actualParty = ActualParty(actualGuests);
            var occupancy = OccupancyRules.Evaluate(actualParty, stayQuantity, stayRoomType.BaseCapacity, stayRoomType.MaxCapacity, stayRoomType.ExtraGuestAllowed, stayRoomType.MaxExtraChildren);
            if (!occupancy.Ok)
                return Conflict(new { message = occupancy.Message + " Hãy dùng Đổi phòng hoặc tạo thêm đơn cho phòng khác trước khi nhận phòng.", problem = occupancy.Problem,
                    suggestions = await occupancySuggestions.For(stayRoomType, actualParty, StayFrom(booking), booking.CheckOutDate, booking.Id) });
            serverGuestFee = GuestFees(occupancy, stayRoomType, StayNights(booking, booking.CheckInDate));
            booking.AdultCount = actualParty.Adults; booking.ChildCount = actualParty.Children;
            booking.TallChildCount = actualParty.TallChildren; booking.SmallChildCount = actualParty.SmallChildren;
        }

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
        // The server-computed fee wins whenever the actual party is known; the client value is only a legacy fallback.
        var guestFee = serverGuestFee ?? request.ExtraGuestFee;
        if (guestFee is > 0)
        {
            var g = request.ActualGuests is { } actual ? ActualParty(actual) : null;
            var desc = g != null
                ? $"Phụ thu thêm khách ({g.Adults} người lớn, {g.TallChildren} trẻ từ 1m2, {g.SmallChildren} trẻ dưới 1m2)"
                : "Phụ thu vượt số lượng khách tiêu chuẩn";
            if (existingGuestCharge is not null)
            {
                existingGuestCharge.UnitPrice = guestFee.Value;
                existingGuestCharge.TotalPrice = guestFee.Value;
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
                    UnitPrice = guestFee.Value,
                    TotalPrice = guestFee.Value,
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
                r.RoomType.ExtraGuestAllowed,
                r.RoomType.MaxExtraChildren,
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

    // Same occupancy rules during the stay: extra children pay for the remaining nights; extra adults need a room change.
    [HttpPost("bookings/{bookingId:long}/add-guests")]
    public async Task<IActionResult> AddGuests(long bookingId, HostAddGuestsRequest request)
    {
        if (request.Adults < 0 || request.TallChildren < 0 || request.SmallChildren < 0 || request.Adults + request.TallChildren + request.SmallChildren < 1)
            return BadRequest(new { message = "Vui lòng nhập số khách thêm." });
        await using var tx = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var booking = await db.Bookings.Include(b => b.Details)
            .SingleOrDefaultAsync(b => b.Id == bookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == HostId));
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        if (booking.Status != BookingStatus.CheckedIn) return Conflict(new { message = "Chỉ thêm khách cho đơn đang lưu trú." });
        var from = StayFrom(booking);
        var nights = StayNights(booking, from);
        if (nights < 1) return Conflict(new { message = "Đơn đã đến ngày trả phòng, không còn đêm để thêm khách." });
        var (roomType, quantity) = await BookingRoomType(booking);
        var current = CurrentParty(booking);
        var next = new Party(current.Adults + request.Adults, current.TallChildren + request.TallChildren, current.SmallChildren + request.SmallChildren);
        var after = OccupancyRules.Evaluate(next, quantity, roomType.BaseCapacity, roomType.MaxCapacity, roomType.ExtraGuestAllowed, roomType.MaxExtraChildren);
        if (!after.Ok)
            return Conflict(new { message = after.Message, problem = after.Problem, suggestions = await occupancySuggestions.For(roomType, next, from, booking.CheckOutDate, booking.Id) });
        var before = OccupancyRules.Evaluate(current, quantity, roomType.BaseCapacity, roomType.MaxCapacity, roomType.ExtraGuestAllowed, roomType.MaxExtraChildren);
        var fee = Math.Max(0, GuestFees(after, roomType, nights) - (before.Ok ? GuestFees(before, roomType, nights) : 0));
        var now = DateTime.UtcNow;
        if (fee > 0)
            db.AdditionalCharges.Add(new AdditionalCharge { BookingId = booking.Id, Type = "extra_guest_midstay",
                Description = $"Thêm khách giữa kỳ ({request.Adults} người lớn, {request.TallChildren} trẻ từ 1m2, {request.SmallChildren} trẻ dưới 1m2) × {nights} đêm còn lại",
                Quantity = 1, UnitPrice = fee, TotalPrice = fee, Status = "Approved", RecordedBy = HostId, CreatedAt = now });
        booking.AdultCount = next.Adults; booking.ChildCount = next.Children; booking.TallChildCount = next.TallChildren; booking.SmallChildCount = next.SmallChildren;
        booking.UpdatedAt = now;
        await LogAudit("AddGuests", bookingId,
            beforeJson: System.Text.Json.JsonSerializer.Serialize(new { adults = current.Adults, tall = current.TallChildren, small = current.SmallChildren }),
            afterJson: System.Text.Json.JsonSerializer.Serialize(new { adults = next.Adults, tall = next.TallChildren, small = next.SmallChildren, fee, nights }),
            reason: request.Note?.Trim());
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return Ok(new { fee, nights, message = fee > 0 ? $"Đã thêm khách, phụ thu {fee:N0}đ cho {nights} đêm còn lại." : "Đã thêm khách, không phát sinh phụ thu." });
    }

    private async Task<(RoomType RoomType, int Quantity)> BookingRoomType(Booking booking)
    {
        var roomTypeId = booking.Details.Select(d => d.RoomTypeId).First();
        return (await db.RoomTypes.AsNoTracking().SingleAsync(r => r.Id == roomTypeId), Math.Max(1, booking.Details.Sum(d => d.Quantity)));
    }

    private static Party ActualParty(HostActualGuestsRequest g) =>
        g.TallChildren > 0 || g.SmallChildren > 0 || g.ChildUnder2 + g.Child2To6 + g.Child6To10 + g.Child10To12 + g.ChildOver12 == 0
            ? new Party(g.Adults, g.TallChildren, g.SmallChildren)
            // Older clients send age buckets: 12+ are adults, 6-11 assumed from 1.2 m, under 6 assumed under 1.2 m.
            : new Party(g.Adults + g.ChildOver12, g.Child6To10 + g.Child10To12, g.ChildUnder2 + g.Child2To6);

    private static Party CurrentParty(Booking b) =>
        b.TallChildCount.HasValue || b.SmallChildCount.HasValue
            ? new Party(b.AdultCount, b.TallChildCount ?? 0, b.SmallChildCount ?? 0)
            : new Party(b.AdultCount, b.ChildCount, 0);

    private static DateOnly StayFrom(Booking b) => BookingRules.Today > b.CheckInDate ? BookingRules.Today : b.CheckInDate;
    private static int StayNights(Booking b, DateOnly from) => Math.Max(0, b.CheckOutDate.DayNumber - from.DayNumber);
    private static decimal GuestFees(OccupancyEvaluation e, RoomType r, int nights) =>
        (e.ExtraAdults * r.ExtraGuestFee + e.ExtraTallChildren * r.ExtraChildFee) * Math.Max(1, nights);
}
