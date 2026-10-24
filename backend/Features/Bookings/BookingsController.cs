using System.Security.Claims;
using System.Text.Json;
using System.Data;
using System.Text.RegularExpressions;
using System.ComponentModel.DataAnnotations;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record BookingGuestInput(string Type, string FullName, DateOnly? BirthDate, string Gender, string Nationality,
    string DocumentType, string? DocumentNumber, string? Address, string? AccompanyingAdult = null);
public sealed record CreateBookingRequest(long RoomTypeId, DateOnly CheckInDate, DateOnly CheckOutDate, int AdultCount, int ChildCount, int Quantity,
    string? CustomerNote, string? RecommendationSessionId = null, IReadOnlyList<int>? ChildAges = null, string? PaymentOption = null,
    int? DayUseHours = null, BookingGuestInput? PrimaryGuest = null, IReadOnlyList<BookingGuestInput>? Companions = null,
    bool DeclareCompanionsLater = false, bool PrivacyAccepted = false, bool PolicyAccepted = false, string? VoucherCode = null);
public sealed record CancelBookingRequest(string Reason);
public sealed record UpdateGuestDeclarationsRequest(IReadOnlyList<BookingGuestInput> Guests, bool PrivacyAccepted);
public sealed record UpdateBookingContactRequest(string ContactName, string Phone, string? Email, string? GuestName);

[ApiController]
[Route("api/bookings")]
public sealed class BookingsController(AppDbContext db, VnPayService vnPay, PaymentService paymentService, RoomInventoryService inventory,
    PolicyService policyService, BookingPricingService pricingService, VoucherService voucherService) : ControllerBase
{
    private static string? ValidateGuest(BookingGuestInput guest, bool primary)
    {
        if (string.IsNullOrWhiteSpace(guest.FullName) || guest.FullName.Trim().Length > 150) return "Họ tên khách không hợp lệ.";
        if (guest.BirthDate is null || guest.BirthDate > BookingRules.Today) return "Ngày sinh của khách không hợp lệ.";
        if (guest.Type is not ("adult" or "child")) return "Loại khách không hợp lệ.";
        var age = BookingRules.Today.Year - guest.BirthDate.Value.Year;
        if (guest.BirthDate.Value > BookingRules.Today.AddYears(-age)) age--;
        if ((guest.Type == "adult" && age < 14) || (guest.Type == "child" && age >= 14)) return "Loại khách không khớp với ngày sinh.";
        if (string.IsNullOrWhiteSpace(guest.Gender) || string.IsNullOrWhiteSpace(guest.Nationality)) return "Vui lòng khai báo giới tính và quốc tịch.";
        var document = guest.DocumentNumber?.Trim();
        if (guest.DocumentType == "CCCD" && !Regex.IsMatch(document ?? "", "^\\d{12}$")) return "Số CCCD phải gồm 12 chữ số.";
        if (guest.DocumentType == "Hộ chiếu" && !Regex.IsMatch(document ?? "", "^[A-Za-z0-9]{6,12}$")) return "Số hộ chiếu không hợp lệ.";
        if ((primary || guest.Type == "adult") && string.IsNullOrWhiteSpace(document)) return "Người lớn phải cung cấp giấy tờ tùy thân.";
        if (primary && string.IsNullOrWhiteSpace(guest.Address)) return "Khách chính phải cung cấp địa chỉ thường trú.";
        if (guest.Type == "child" && string.IsNullOrWhiteSpace(guest.AccompanyingAdult)) return "Trẻ em phải khai báo người đi cùng.";
        return null;
    }
    private static object CancellationQuote(Booking booking, decimal paidAmount)
    {
        var daysBeforeCheckIn = booking.CheckInDate.DayNumber - BookingRules.Today.DayNumber;
        var policy = PolicyService.ParseSnapshot(booking.PolicySnapshotJson); var percent = PolicyService.RefundPercent(policy, daysBeforeCheckIn);
        var result = BookingRules.Cancellation(paidAmount, daysBeforeCheckIn, percent);
        return new { booking.Id, booking.BookingCode, daysBeforeCheckIn, isFree = result.Penalty == 0, refundPercent = percent, cancellationFee = result.Penalty, refundAmount = result.Refund, policyVersion = policy.Version };
    }

    private sealed record BookingTotals(decimal AppliedDiscount, bool VoucherApplied, decimal Subtotal, decimal CustomerTaxPercent,
        decimal TaxAmount, decimal Total, decimal AmountDueNow);

    // Single source of truth for what the guest pays, shared by the quote and the real booking so the
    // quoted amount can never drift from the charged amount. The better of promotion and voucher wins.
    private async Task<BookingTotals> ComputeTotals(BookingPricingResult price, VoucherQuote? voucher)
    {
        var appliedDiscount = Math.Max(price.DiscountAmount, voucher?.DiscountAmount ?? 0);
        var voucherApplied = voucher is not null && voucher.DiscountAmount >= price.DiscountAmount;
        var subtotal = Math.Max(0, price.TotalAmount + price.DiscountAmount - appliedDiscount);
        var customerTaxPercent = await CustomerTaxSettings.ReadPercent(db);
        var taxAmount = CustomerTaxSettings.Amount(subtotal, customerTaxPercent);
        var total = subtotal + taxAmount;
        var amountDueNow = price.PaymentOption == "Full"
            ? total
            : Math.Round(total * price.DepositPercent / 100m, 0, MidpointRounding.AwayFromZero);
        return new BookingTotals(appliedDiscount, voucherApplied, subtotal, customerTaxPercent, taxAmount, total, amountDueNow);
    }

    private static int ExtraChildren(CreateBookingRequest request, RoomType roomType) =>
        request.ChildAges is { Count: > 0 } ? request.ChildAges.Count(x => x >= 2) :
            Math.Max(0, request.ChildCount - Math.Max(0, roomType.BaseCapacity * request.Quantity - request.AdultCount));

    [AllowAnonymous]
    [EnableRateLimiting("booking-quote")]
    [HttpPost("quote")]
    public async Task<IActionResult> Quote(CreateBookingRequest request)
    {
        var isDayUse = request.CheckOutDate == request.CheckInDate && request.DayUseHours is > 0;
        if (request.CheckOutDate < request.CheckInDate || request.CheckInDate < BookingRules.Today)
            return BadRequest(new { message = "Ngày nhận hoặc trả phòng không hợp lệ." });
        if (BookingRules.ValidateGuests(request.AdultCount, request.ChildCount, request.Quantity) is not null)
            return BadRequest(new { message = "Số khách hoặc số phòng không hợp lệ." });
        var childAgeError = BookingPricingService.ValidateChildAges(request.ChildCount, request.ChildAges);
        if (childAgeError is not null) return BadRequest(new { message = childAgeError });
        var roomType = await db.RoomTypes.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.RoomTypeId && x.Status == "Active" && x.Homestay.Status == "Approved");
        if (roomType is null) return NotFound(new { message = "Không tìm thấy loại phòng đang kinh doanh." });
        var policy = await policyService.Resolve(roomType.HomestayId, DateTime.UtcNow);
        if (isDayUse && (policy.Document?.DayUse.Enabled != true || request.DayUseHours is < 1 or > 12))
            return BadRequest(new { message = "Chính sách đặt phòng trong ngày không khả dụng hoặc thời lượng không hợp lệ." });
        if (!isDayUse && request.CheckOutDate == request.CheckInDate)
            return BadRequest(new { message = "Vui lòng chọn thời lượng đặt phòng trong ngày." });
        var inventoryCheckOut = isDayUse ? request.CheckInDate.AddDays(1) : request.CheckOutDate;
        var allowedCapacity = (roomType.ExtraGuestAllowed ? roomType.MaxCapacity : roomType.BaseCapacity) * request.Quantity;
        var capacityError = BookingRules.ValidateCapacity(request.AdultCount, request.ChildCount, request.Quantity,
            allowedCapacity / request.Quantity);
        if (capacityError is not null) return BadRequest(new { message = capacityError });
        var available = (await BookingAvailability.AvailableRoomIds(db, roomType.Id, request.CheckInDate, inventoryCheckOut, DateTime.UtcNow)).Count;
        if (available < request.Quantity)
        {
            db.BookingConflictEvents.Add(new BookingConflictEvent { CustomerId = long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId) ? customerId : null,
                RoomTypeId = request.RoomTypeId, CheckInDate = request.CheckInDate, CheckOutDate = request.CheckOutDate,
                RequestedQuantity = request.Quantity, AvailableQuantity = available, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return Conflict(new { message = "Không còn đủ phòng trong khoảng ngày đã chọn." });
        }
        var periods = await db.RoomPricePeriods.AsNoTracking().Where(x => x.RoomTypeId == roomType.Id && x.StartDate < inventoryCheckOut && x.EndDate >= request.CheckInDate).ToListAsync();
        var price = pricingService.Calculate(roomType, request.CheckInDate, request.CheckOutDate, request.AdultCount, request.ChildCount,
            request.Quantity, request.ChildAges, request.PaymentOption, periods, policy, BookingRules.Today, request.DayUseHours);
        var quoteCustomerId = long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsedCustomerId) ? parsedCustomerId : (long?)null;
        var (voucher, voucherError) = await voucherService.Validate(request.VoucherCode, roomType.HomestayId, quoteCustomerId,
            price.RoomAmountBeforeDiscount, DateTime.UtcNow);
        if (voucherError is not null) return BadRequest(new { message = voucherError });
        var totals = await ComputeTotals(price, voucher);
        var extraChildren = ExtraChildren(request, roomType);
        return Ok(new { price.Nights, quantity = request.Quantity, roomTotal = price.RoomAmount, extraGuestCount = price.ExtraAdults + extraChildren,
            extraAdults = price.ExtraAdults, extraChildren, price.ExtraAdultFee, extraChildFee = price.ChildSurcharge,
            extraGuestFee = price.ExtraAdultFee + price.ChildSurcharge, extraFee = price.ExtraAdultFee + price.ChildSurcharge,
            subtotal = totals.Subtotal, totals.CustomerTaxPercent, totals.TaxAmount, total = totals.Total, availableRooms = available, price.BaseRoomAmount, price.SeasonalSurchargeAmount,
            price.RoomAmountBeforeDiscount, promotionCode = totals.VoucherApplied ? null : price.PromotionCode, promotionPercent = totals.VoucherApplied ? 0 : price.PromotionPercent,
            discountAmount = totals.AppliedDiscount, voucherCode = totals.VoucherApplied ? voucher!.Code : null, voucherName = totals.VoucherApplied ? voucher!.Name : null,
            price.DepositPercent, depositAmount = totals.AmountDueNow, totals.AmountDueNow, price.PaymentOption,
            price.MinNightlyPrice, price.MaxNightlyPrice, price.NightlyRoomTotal, price.NightsBreakdown,
            price.ChildrenBreakdown, isDayUse, dayUseHours = isDayUse ? request.DayUseHours : null, policyVersion = policy.Version });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine()
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var items = await db.Bookings.AsNoTracking().Where(x => x.CustomerId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.BookingCode, x.HomestayId, HomestayName = x.Homestay.Name,
                HomestayImage = x.Homestay.Images.OrderByDescending(i => i.IsThumbnail).ThenBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                Address = x.Homestay.AddressLine + ", " + x.Homestay.District + ", " + x.Homestay.Province,
                HostPhone = db.Users.Where(u => u.Id == x.Homestay.HostId).Select(u => u.PhoneNumber).FirstOrDefault(),
                City = x.Homestay.District,
                Province = x.Homestay.Province,
                x.CheckInDate, x.CheckOutDate, x.HoldExpiresAt, Nights = x.Details.Select(d => (int?)d.NumberOfNights).FirstOrDefault() ?? 0, x.AdultCount, x.ChildCount, x.TotalAmount,
                Rooms = x.Details.Select(d => d.RoomId == null ? db.RoomTypes.Where(t => t.Id == d.RoomTypeId).Select(t => t.Name).First() : db.Rooms.Where(r => r.Id == d.RoomId).Select(r => r.RoomNumber).First()).ToList(),
                RoomTypeId = x.Details.Select(d => (long?)d.RoomTypeId).FirstOrDefault(),
                Details = x.Details.Select(d => new { d.RoomTypeId, d.RoomId }).ToList(),
                ActiveServiceRequestCount = db.GuestServiceRequests.Count(r => r.BookingId == x.Id && (r.Status == "Pending" || r.Status == "Approved" || r.Status == "ChangeProposed" || r.Status == "InProgress" || r.Status == "HostCompleted")),
                Status = x.Status == BookingStatus.Hold && x.HoldExpiresAt <= DateTime.UtcNow ? BookingStatus.Expired : x.Status, x.CreatedAt,
                CanReview = x.Status == BookingStatus.CheckedOut && x.ReviewCreateUntil >= BookingRules.Today && !db.Reviews.Any(r => r.BookingId == x.Id),
                Review = db.Reviews.Where(r => r.BookingId == x.Id).Select(r => new { r.Id, r.Rating, r.Comment, r.CleanlinessRating, r.LocationRating, r.HostRating, r.ValueRating, r.HostReply, r.HostRepliedAt, r.CreatedAt, CanEdit = x.ReviewEditUntil >= BookingRules.Today }).FirstOrDefault(),
                Cancellation = db.Cancellations.Where(c => c.BookingId == x.Id).Select(c => new { c.Reason, c.CancellationFee, c.RefundAmount, Status = c.Status == "Approved" && db.Payments.Any(p => p.BookingId == x.Id && p.TransactionType == "Refund" && p.Status == "Pending") ? "RefundPending" : c.Status, c.CancelledAt, c.ProcessedAt }).FirstOrDefault() })
            .ToListAsync();
        return Ok(new { items });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpGet("{bookingId:long}")]
    public async Task<IActionResult> GetDetail(long bookingId)
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var item = await db.Bookings.AsNoTracking().Where(x => x.Id == bookingId && x.CustomerId == userId)
            .Select(x => new { x.Id, x.BookingCode, x.HomestayId, HomestayName = x.Homestay.Name,
                Address = x.Homestay.AddressLine + ", " + x.Homestay.Ward + ", " + x.Homestay.District + ", " + x.Homestay.Province,
                CheckInTime = x.Homestay.CheckInTime, CheckOutTime = x.Homestay.CheckOutTime,
                HostName = db.Users.Where(u => u.Id == x.Homestay.HostId).Select(u => u.FullName).First(),
                HostPhone = db.Users.Where(u => u.Id == x.Homestay.HostId).Select(u => u.PhoneNumber).FirstOrDefault(),
                HomestayImage = x.Homestay.Images.OrderByDescending(i => i.IsThumbnail).ThenBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                Province = x.Homestay.Province,
                x.CheckInDate, x.CheckOutDate, x.AdultCount, x.ChildCount, x.Subtotal, x.DiscountAmount, x.ServiceFee, x.TaxAmount, x.TotalAmount, x.RoomAmount, x.DepositAmount, x.PaymentStatus, x.HoldExpiresAt, Status = x.Status == BookingStatus.Hold && x.HoldExpiresAt <= DateTime.UtcNow ? BookingStatus.Expired : x.Status, x.CustomerNote, x.CreatedAt,
                ContactName = x.ContactName ?? db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.FullName).First(),
                ContactPhone = x.ContactPhone ?? db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.PhoneNumber).FirstOrDefault(),
                ContactEmail = x.ContactEmail ?? db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.Email).First(),
                GuestName = x.GuestName ?? x.Guests.Where(g => g.IsPrimary).Select(g => g.FullName).FirstOrDefault() ?? x.ContactName ?? db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.FullName).First(),
                x.ContactNameEditCount,
                PaidAmount = x.Payments.Where(p => p.TransactionType != "Refund" && p.Status == "Success").Sum(p => (decimal?)p.Amount) ?? 0,
                RefundedAmount = x.Payments.Where(p => p.TransactionType == "Refund" && p.Status == "Success").Sum(p => (decimal?)p.Amount) ?? 0,
                RoomTypeId = x.Details.Select(d => (long?)d.RoomTypeId).FirstOrDefault(),
                Details = x.Details.Select(d => new { d.Id, d.RoomTypeId, RoomTypeName = db.RoomTypes.Where(r => r.Id == d.RoomTypeId).Select(r => r.Name).First(), d.RoomId, RoomNumber = d.RoomId == null ? null : db.Rooms.Where(r => r.Id == d.RoomId).Select(r => r.RoomNumber).FirstOrDefault(), d.Quantity, d.PricePerNight, d.NumberOfNights, d.ExtraFee, d.LineTotal, d.GuestName, d.Note }).ToList(),
                Guests = x.Guests.OrderByDescending(g => g.IsPrimary).ThenBy(g => g.Id).Select(g => new { g.Id, g.IsPrimary, Type = g.GuestType, g.FullName, g.BirthDate, g.Gender, g.Nationality, g.DocumentType, DocumentNumber = g.DocumentNumber == null ? null : "***" + g.DocumentNumber.Substring(Math.Max(0, g.DocumentNumber.Length - 4)), g.Address, g.AccompanyingAdult, g.DeclarationStatus, g.DeclarationDueAt }).ToList(),
                Payments = x.Payments.OrderByDescending(p => p.CreatedAt).Select(p => new { p.Id, p.PaymentMethod, p.TransactionType, p.Amount, p.Status, p.PaidAt, p.CreatedAt }).ToList(),
                Cancellation = db.Cancellations.Where(c => c.BookingId == x.Id).Select(c => new { c.Reason, c.CancellationFee, c.RefundAmount, c.Status, c.CancelledAt }).FirstOrDefault() })
            .SingleOrDefaultAsync();
        return item is null ? NotFound(new { message = "Không tìm thấy đơn đặt phòng." }) : Ok(item);
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPatch("{bookingId:long}/contact")]
    public async Task<IActionResult> UpdateContact(long bookingId, UpdateBookingContactRequest request)
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var booking = await db.Bookings.Include(x => x.Guests).SingleOrDefaultAsync(x => x.Id == bookingId && x.CustomerId == userId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });

        var fullEdit = booking.Status == BookingStatus.Hold
            || (booking.Status == BookingStatus.Confirmed && booking.CheckInDate > BookingRules.Today);
        var limitedEdit = booking.Status is BookingStatus.CheckedIn or BookingStatus.CheckoutPendingPayment;
        if (!fullEdit && !limitedEdit)
            return BadRequest(new { message = "Trạng thái hiện tại không cho phép sửa người liên hệ." });

        var user = await db.Users.AsNoTracking().SingleAsync(x => x.Id == userId);
        var oldContactName = (booking.ContactName ?? user.FullName).Trim();
        var oldGuestName = (booking.GuestName ?? booking.Guests.FirstOrDefault(x => x.IsPrimary)?.FullName ?? oldContactName).Trim();
        var contactName = request.ContactName?.Trim() ?? "";
        var guestName = string.IsNullOrWhiteSpace(request.GuestName) ? contactName : request.GuestName.Trim();
        var compactPhone = Regex.Replace(request.Phone ?? "", "[\\s.()-]", "");
        if (contactName.Length is < 2 or > 150) return BadRequest(new { field = "contactName", message = "Họ tên người liên hệ phải có ít nhất 2 ký tự." });
        if (!Regex.IsMatch(compactPhone, "^(0\\d{9}|\\+84\\d{9})$"))
            return BadRequest(new { field = "phone", message = "Số điện thoại chưa đúng, vui lòng nhập 10 số bắt đầu bằng 0." });
        if (guestName.Length is < 2 or > 150) return BadRequest(new { field = "guestName", message = "Họ tên khách nhận phòng phải có ít nhất 2 ký tự." });
        var email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        if (email is { Length: > 255 } || (email is not null && !new EmailAddressAttribute().IsValid(email)))
            return BadRequest(new { field = "email", message = "Email chưa đúng định dạng." });
        if (compactPhone.StartsWith("+84")) compactPhone = "0" + compactPhone[3..];

        var nameChanged = !string.Equals(contactName, oldContactName, StringComparison.Ordinal);
        var guestChanged = !string.Equals(guestName, oldGuestName, StringComparison.Ordinal);
        if (limitedEdit && (nameChanged || guestChanged))
            return BadRequest(new { message = "Đơn đã nhận phòng nên không thể đổi tên người liên hệ hoặc khách nhận phòng." });
        if ((nameChanged || guestChanged) && booking.ContactNameEditCount >= 3)
            return BadRequest(new { message = "Đơn này đã dùng hết 3 lần chỉnh sửa họ tên khách nhận phòng." });

        var changedFields = new List<string>();
        if (nameChanged) changedFields.Add("contactName");
        if (guestChanged) changedFields.Add("guestName");
        if (!string.Equals(compactPhone, booking.ContactPhone ?? user.PhoneNumber, StringComparison.Ordinal)) changedFields.Add("phone");
        if (!string.Equals(email, booking.ContactEmail ?? user.Email, StringComparison.OrdinalIgnoreCase)) changedFields.Add("email");
        if (changedFields.Count == 0) return Ok(new { booking.Id, booking.BookingCode, booking.Status, contact = new { contactName = oldContactName, phone = compactPhone, email, guestName = oldGuestName, booking.ContactNameEditCount } });

        booking.ContactName = contactName;
        booking.ContactPhone = compactPhone;
        booking.ContactEmail = email ?? "";
        booking.GuestName = guestName;
        if (nameChanged || guestChanged) booking.ContactNameEditCount++;
        var primaryGuest = booking.Guests.FirstOrDefault(x => x.IsPrimary);
        if (guestChanged && primaryGuest is not null) { primaryGuest.FullName = guestName; primaryGuest.UpdatedAt = DateTime.UtcNow; }
        booking.ContactUpdatedAt = DateTime.UtcNow;
        booking.UpdatedAt = DateTime.UtcNow;
        db.AuditLogs.Add(new AuditLog { ActorId = userId, ActorRole = "Customer", Action = "booking.contact_updated", TargetType = "Booking", TargetId = booking.Id.ToString(), AfterJson = JsonSerializer.Serialize(new { fields = changedFields }), Ip = HttpContext.Connection.RemoteIpAddress, CreatedAt = DateTime.UtcNow });
        db.OutboxMessages.Add(new OutboxMessage { Type = "booking.contact_updated", PayloadJson = JsonSerializer.Serialize(new { bookingId = booking.Id, bookingCode = booking.BookingCode, homestayId = booking.HomestayId }), Status = "Pending", AvailableAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return Ok(new { booking.Id, booking.BookingCode, booking.Status, contact = new { contactName, phone = compactPhone, email, guestName, booking.ContactNameEditCount, booking.ContactUpdatedAt } });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPut("{bookingId:long}/guests")]
    public async Task<IActionResult> UpdateGuestDeclarations(long bookingId, UpdateGuestDeclarationsRequest request)
    {
        if (!request.PrivacyAccepted) return BadRequest(new { message = "Cần đồng ý xử lý dữ liệu cá nhân." });
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var booking = await db.Bookings.Include(x => x.Guests).SingleOrDefaultAsync(x => x.Id == bookingId && x.CustomerId == userId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        var declarationDueAt = new DateTimeOffset(booking.CheckInDate.ToDateTime(TimeOnly.MinValue).AddHours(-24), TimeSpan.FromHours(7)).UtcDateTime;
        if (declarationDueAt < DateTime.UtcNow)
            return BadRequest(new { message = "Đã quá hạn khai báo thông tin khách đi cùng." });
        var deferred = booking.Guests.Where(x => !x.IsPrimary).OrderBy(x => x.Id).ToList();
        if (request.Guests.Count != deferred.Count) return BadRequest(new { message = "Số khách khai báo không khớp với đơn đặt phòng." });
        foreach (var guest in request.Guests) if (ValidateGuest(guest, false) is { } error) return BadRequest(new { message = error });
        var now = DateTime.UtcNow;
        for (var index = 0; index < deferred.Count; index++)
        {
            var entity = deferred[index]; var input = request.Guests[index];
            entity.GuestType = input.Type; entity.FullName = input.FullName.Trim(); entity.BirthDate = input.BirthDate; entity.Gender = input.Gender;
            entity.Nationality = input.Nationality; entity.DocumentType = input.DocumentType; entity.DocumentNumber = input.DocumentNumber?.Trim();
            entity.Address = input.Address?.Trim(); entity.AccompanyingAdult = input.AccompanyingAdult?.Trim(); entity.DeclarationDeferred = false;
            entity.DeclarationStatus = "Completed"; entity.UpdatedAt = now;
        }
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã hoàn tất khai báo lưu trú cho khách đi cùng." });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpGet("{bookingId:long}/cancellation-quote")]
    public async Task<IActionResult> GetCancellationQuote(long bookingId)
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var booking = await db.Bookings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == bookingId && x.CustomerId == userId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        if (!BookingRules.CanCancel(booking.Status, booking.HoldExpiresAt ?? booking.UpdatedAt, booking.CheckInDate, BookingRules.Today, DateTime.UtcNow)) return BadRequest(new { message = "Đơn này không còn đủ điều kiện hủy." });
        var paid = await db.Payments.Where(x => x.BookingId == bookingId && x.TransactionType != "Refund" && x.Status == "Success").SumAsync(x => (decimal?)x.Amount) ?? 0;
        return Ok(CancellationQuote(booking, paid));
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPost("{bookingId:long}/cancel")]
    public async Task<IActionResult> Cancel(long bookingId, CancelBookingRequest request)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId);
        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 500) return BadRequest(new { message = "Vui lòng nhập lý do hủy, tối đa 500 ký tự." });
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var booking = await db.Bookings.SingleOrDefaultAsync(x => x.Id == bookingId && x.CustomerId == userId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        if (!BookingRules.CanCancel(booking.Status, booking.HoldExpiresAt ?? booking.UpdatedAt, booking.CheckInDate, BookingRules.Today, DateTime.UtcNow)) return BadRequest(new { message = "Đơn này không còn đủ điều kiện hủy." });
        if (await db.Cancellations.AnyAsync(x => x.BookingId == bookingId)) return Conflict(new { message = "Đơn đã có yêu cầu hủy." });
        var paid = await db.Payments.Where(x => x.BookingId == bookingId && x.TransactionType != "Refund" && x.Status == "Success").SumAsync(x => (decimal?)x.Amount) ?? 0;
        var snapshot = PolicyService.ParseSnapshot(booking.PolicySnapshotJson); var refundPercent = PolicyService.RefundPercent(snapshot, booking.CheckInDate.DayNumber - BookingRules.Today.DayNumber);
        var result = BookingRules.Cancellation(paid, booking.CheckInDate.DayNumber - BookingRules.Today.DayNumber, refundPercent);
        db.Cancellations.Add(new Cancellation { BookingId = booking.Id, CancelledBy = userId, Reason = reason, CancelledAt = DateTime.UtcNow, CancellationFee = result.Penalty, RefundAmount = result.Refund, RefundPercent = result.Percent, PaidAmountAtCancellation = paid, Status = "Approved", ProcessedAt = DateTime.UtcNow });
        if (result.Refund > 0)
        {
            var refundCode = $"CAN-RF-{Guid.NewGuid():N}";
            db.Payments.Add(new Payment { BookingId = booking.Id, TransactionCode = refundCode, PaymentMethod = "Original", TransactionType = "Refund", Amount = result.Refund, Status = "Pending", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
            db.OutboxMessages.Add(new OutboxMessage { Type = "refund.requested", PayloadJson = JsonSerializer.Serialize(new { bookingId = booking.Id, paymentTransactionCode = refundCode, amount = result.Refund, reason }), Status = "Pending", AvailableAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow });
        }
        booking.Status = BookingStatus.Cancelled; booking.PaymentStatus = result.Refund > 0 ? PaymentStatus.RefundPending : booking.PaymentStatus; booking.UpdatedAt = DateTime.UtcNow;
        await db.AdditionalCharges.Where(x => x.BookingId == bookingId && !x.IsPaid).ExecuteUpdateAsync(x => x.SetProperty(c => c.Status, ChargeStatus.Waived).SetProperty(c => c.TotalPrice, 0));
        await db.BookingRoomStays.Where(x => x.BookingId == bookingId && x.Status == "Active").ExecuteUpdateAsync(x => x.SetProperty(s => s.Status, "Cancelled"));
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { message = "Đã hủy booking; khoản hoàn tiền (nếu có) đã được đưa vào hàng đợi xử lý.", cancellationFee = result.Penalty, refundAmount = result.Refund });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPost("vnpay")]
    public async Task<IActionResult> CreateVnPayPayment(CreateBookingRequest request)
    {
        if (!vnPay.IsConfigured) return StatusCode(503, new { message = "VNPay chưa được cấu hình. Vui lòng thêm VNPAY_TMN_CODE và VNPAY_HASH_SECRET." });
        var isDayUse = request.CheckOutDate == request.CheckInDate && request.DayUseHours is > 0;
        if (request.CheckInDate < BookingRules.Today || request.CheckOutDate < request.CheckInDate)
            return BadRequest(new { message = "Ngày nhận hoặc trả phòng không hợp lệ." });
        if (BookingRules.ValidateGuests(request.AdultCount, request.ChildCount, request.Quantity) is not null) return BadRequest(new { message = "Số khách hoặc số phòng không hợp lệ." });
        if (!request.PrivacyAccepted || !request.PolicyAccepted) return BadRequest(new { message = "Bạn cần đồng ý xử lý dữ liệu cá nhân và chính sách hủy/hoàn cọc." });
        if (request.PrimaryGuest is null) return BadRequest(new { message = "Thiếu thông tin khách chính." });
        if (ValidateGuest(request.PrimaryGuest, true) is { } primaryGuestError) return BadRequest(new { message = primaryGuestError });
        var expectedCompanions = request.AdultCount + request.ChildCount - 1;
        var companionInputs = request.Companions ?? [];
        if (!request.DeclareCompanionsLater && companionInputs.Count != expectedCompanions)
            return BadRequest(new { message = "Số hồ sơ khách đi cùng không khớp với số khách đã chọn." });
        if (!request.DeclareCompanionsLater)
            foreach (var companion in companionInputs)
                if (ValidateGuest(companion, false) is { } companionError) return BadRequest(new { message = companionError });
        var childAgeError = BookingPricingService.ValidateChildAges(request.ChildCount, request.ChildAges);
        if (childAgeError is not null) return BadRequest(new { message = childAgeError });

        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        string? recommendationSessionId = null;
        if (Guid.TryParse(request.RecommendationSessionId, out _))
        {
            var attributionSince = DateTime.UtcNow.AddDays(-7);
            recommendationSessionId = await db.RecommendationEvents.AsNoTracking()
                .Where(e => e.SessionId == request.RecommendationSessionId && e.Source == "real"
                    && e.EventType == "search" && e.OccurredAt >= attributionSince
                    && (e.CustomerId == null || e.CustomerId == userId))
                .Select(e => e.SessionId).FirstOrDefaultAsync();
        }
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        await AdvisoryLocks.RoomType(db, request.RoomTypeId);

        var roomType = await db.RoomTypes.Include(x => x.Rooms)
            .SingleOrDefaultAsync(x => x.Id == request.RoomTypeId && x.Status == "Active" && x.Homestay.Status == "Approved");
        if (roomType is null) return NotFound(new { message = "Loại phòng không tồn tại hoặc Homestay chưa được duyệt." });
        var policy = await policyService.Resolve(roomType.HomestayId, DateTime.UtcNow);
        if (isDayUse && (policy.Document?.DayUse.Enabled != true || request.DayUseHours is < 1 or > 12))
            return BadRequest(new { message = "Chính sách đặt phòng trong ngày không khả dụng hoặc thời lượng không hợp lệ." });
        if (!isDayUse && request.CheckOutDate == request.CheckInDate)
            return BadRequest(new { message = "Vui lòng chọn thời lượng đặt phòng trong ngày." });
        var inventoryCheckOut = isDayUse ? request.CheckInDate.AddDays(1) : request.CheckOutDate;
        var allowedCapacity = (roomType.ExtraGuestAllowed ? roomType.MaxCapacity : roomType.BaseCapacity) * request.Quantity;
        var capacityError = BookingRules.ValidateCapacity(request.AdultCount, request.ChildCount, request.Quantity,
            allowedCapacity / request.Quantity);
        if (capacityError is not null) return BadRequest(new { message = capacityError });

        var allocatableRooms = (await BookingAvailability.AvailableRoomIds(db, roomType.Id, request.CheckInDate, inventoryCheckOut, DateTime.UtcNow)).Take(request.Quantity).ToList();
        if (allocatableRooms.Count < request.Quantity)
        {
            db.BookingConflictEvents.Add(new BookingConflictEvent { CustomerId = userId, RoomTypeId = request.RoomTypeId,
                CheckInDate = request.CheckInDate, CheckOutDate = request.CheckOutDate, RequestedQuantity = request.Quantity,
                AvailableQuantity = allocatableRooms.Count, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync(); await transaction.CommitAsync();
            return Conflict(new { message = "Loại phòng này đã hết phòng trong khoảng ngày bạn chọn." });
        }

        var specialPrices = await db.RoomPricePeriods.AsNoTracking().Where(x => x.RoomTypeId == roomType.Id && x.StartDate < inventoryCheckOut && x.EndDate >= request.CheckInDate).ToListAsync();
        var price = pricingService.Calculate(roomType, request.CheckInDate, request.CheckOutDate, request.AdultCount, request.ChildCount,
            request.Quantity, request.ChildAges, request.PaymentOption, specialPrices, policy, BookingRules.Today, request.DayUseHours);
        VoucherQuote? voucher = null;
        if (!string.IsNullOrWhiteSpace(request.VoucherCode))
        {
            var voucherId = await db.Vouchers.Where(x => x.Code == request.VoucherCode.Trim().ToUpper()).Select(x => (long?)x.Id).SingleOrDefaultAsync();
            if (voucherId.HasValue) await AdvisoryLocks.Voucher(db, voucherId.Value);
            var validation = await voucherService.Validate(request.VoucherCode, roomType.HomestayId, userId, price.RoomAmountBeforeDiscount, DateTime.UtcNow);
            if (validation.Error is not null) return BadRequest(new { message = validation.Error });
            voucher = validation.Quote;
        }
        var (appliedDiscount, voucherApplied, subtotal, customerTaxPercent, taxAmount, totalAmount, depositAmount) = await ComputeTotals(price, voucher);
        var nights = price.Nights;
        var roomTotal = Math.Max(0, price.RoomAmountBeforeDiscount - appliedDiscount);
        var extraFee = price.ExtraAdultFee + price.ChildSurcharge;
        var extraGuestCount = price.ExtraAdults + ExtraChildren(request, roomType);
        var now = DateTime.UtcNow;
        var bookingCode = $"TRP{now:yyMMddHHmmss}{Guid.NewGuid():N}"[..24].ToUpperInvariant();
        var transactionCode = $"{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant();
        var booking = new Booking { BookingCode = bookingCode, CustomerId = userId, HomestayId = roomType.HomestayId, CheckInDate = request.CheckInDate, CheckOutDate = inventoryCheckOut, AdultCount = request.AdultCount, ChildCount = request.ChildCount, RoomAmount = roomTotal, DepositAmount = depositAmount, PaymentStatus = PaymentStatus.Unpaid, HoldExpiresAt = now.AddMinutes(policy.HoldMinutes), Subtotal = subtotal, DiscountAmount = appliedDiscount, ServiceFee = 0, TaxAmount = taxAmount, TotalAmount = totalAmount, CommissionRate = policy.CommissionRate, Status = BookingStatus.Hold, CustomerNote = request.CustomerNote, RecommendationSessionId = recommendationSessionId, PricingSnapshotJson = JsonSerializer.Serialize(new { roomType.Id, roomType.Name, nightlyPrice = roomType.BasePrice, roomAmount = roomTotal, nights, isDayUse, dayUseHours = isDayUse ? request.DayUseHours : null, displayCheckOutDate = request.CheckOutDate, roomType.BaseCapacity, roomType.MaxCapacity, adultExtraFee = roomType.ExtraGuestFee, roomType.ExtraChildFee, roomType.ChildMaxAge, roomType.DepositPercent, request.ChildAges, customerTaxPercent, taxAmount, totalAmount, voucherCode = voucherApplied ? voucher!.Code : null, promotionCode = voucherApplied ? null : price.PromotionCode, discountAmount = appliedDiscount, price }), PolicySnapshotJson = PolicyService.Serialize(policy), ReviewCreateUntil = inventoryCheckOut.AddDays(policy.ReviewCreateDays), ReviewEditUntil = inventoryCheckOut.AddDays(policy.ReviewEditDays), CreatedAt = now, UpdatedAt = now };
        booking.Guests.Add(new BookingGuest { IsPrimary = true, GuestType = request.PrimaryGuest.Type, FullName = request.PrimaryGuest.FullName.Trim(), BirthDate = request.PrimaryGuest.BirthDate, Gender = request.PrimaryGuest.Gender, Nationality = request.PrimaryGuest.Nationality, DocumentType = request.PrimaryGuest.DocumentType, DocumentNumber = request.PrimaryGuest.DocumentNumber?.Trim(), Address = request.PrimaryGuest.Address?.Trim(), DeclarationStatus = "Completed", CreatedAt = now, UpdatedAt = now });
        if (request.DeclareCompanionsLater)
        {
            var declarationDueAt = new DateTimeOffset(
                request.CheckInDate.ToDateTime(TimeOnly.MinValue).AddHours(-24),
                TimeSpan.FromHours(7)).UtcDateTime;
            for (var index = 0; index < expectedCompanions; index++) booking.Guests.Add(new BookingGuest { IsPrimary = false, GuestType = index < Math.Max(0, request.AdultCount - 1) ? "adult" : "child", FullName = "Chưa khai báo", Gender = "Chưa khai báo", Nationality = "Chưa khai báo", DocumentType = "Chưa có giấy tờ", DeclarationDeferred = true, DeclarationStatus = "Deferred", DeclarationDueAt = declarationDueAt, CreatedAt = now, UpdatedAt = now });
        }
        else foreach (var guest in companionInputs) booking.Guests.Add(new BookingGuest { IsPrimary = false, GuestType = guest.Type, FullName = guest.FullName.Trim(), BirthDate = guest.BirthDate, Gender = guest.Gender, Nationality = guest.Nationality, DocumentType = guest.DocumentType, DocumentNumber = guest.DocumentNumber?.Trim(), Address = guest.Address?.Trim(), AccompanyingAdult = guest.AccompanyingAdult?.Trim(), DeclarationStatus = "Completed", CreatedAt = now, UpdatedAt = now });
        var perRoomExtraFee = extraFee / request.Quantity;
        var perRoomLineTotal = subtotal / request.Quantity;
        foreach (var room in allocatableRooms)
        {
            var billingUnits = Math.Max(1, nights);
            booking.Details.Add(new BookingDetail { RoomTypeId = roomType.Id, RoomId = room, Quantity = 1, PricePerNight = price.RoomAmountBeforeDiscount / request.Quantity / billingUnits, NumberOfNights = nights, ExtraFee = perRoomExtraFee, LineTotal = perRoomLineTotal });
            inventory.Allocate(booking, room, request.CheckInDate, inventoryCheckOut, price.RoomAmountBeforeDiscount / request.Quantity / billingUnits);
        }
        if (extraFee > 0) booking.AdditionalCharges.Add(new AdditionalCharge { Type = "extra_guest", Description = "Phụ thu khách vượt sức chứa cơ bản", Quantity = 1, UnitPrice = extraFee, TotalPrice = extraFee, RecordedBy = userId, CreatedAt = now });
        booking.Payments.Add(new Payment { TransactionCode = transactionCode, PaymentMethod = "VNPay", TransactionType = "Deposit", Amount = depositAmount, Status = "Pending", CreatedAt = now, UpdatedAt = now });
        db.Bookings.Add(booking);
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "127.0.0.1";
        var paymentUrl = vnPay.CreatePaymentUrl(transactionCode, depositAmount, $"Thanh toan coc {bookingCode}", ip, policy.HoldMinutes);
        await db.SaveChangesAsync();
        if (voucherApplied)
        {
            db.VoucherUsages.Add(new VoucherUsage { VoucherId = voucher!.Id, BookingId = booking.Id, CustomerId = userId,
                CodeUsed = voucher.Code, DiscountAmount = voucher.DiscountAmount, UsedAt = now });
            await db.SaveChangesAsync();
        }
        await transaction.CommitAsync();
        return Ok(new { bookingCode, amount = depositAmount, depositAmount, paymentUrl, paymentOption = price.PaymentOption,
            priceBreakdown = new { roomTotal, extraGuestCount, extraGuestFee = extraFee, extraFee, price.BaseRoomAmount,
                price.SeasonalSurchargeAmount, discountAmount = appliedDiscount, promotionCode = voucherApplied ? null : price.PromotionCode,
                voucherCode = voucherApplied ? voucher!.Code : null, subtotal, customerTaxPercent, taxAmount, total = totalAmount,
                price.DepositPercent, price.NightsBreakdown, price.ChildrenBreakdown } });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPost("{bookingId:long}/retry-payment")]
    public async Task<IActionResult> RetryPayment(long bookingId)
    {
        if (!vnPay.IsConfigured) return StatusCode(503, new { message = "VNPay chưa được cấu hình." });
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        await BookingAvailability.LockBooking(db, bookingId);
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var booking = await db.Bookings.Include(x => x.Details)
            .SingleOrDefaultAsync(x => x.Id == bookingId && x.CustomerId == userId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy booking." });
        if (booking.Status is not (BookingStatus.Hold or BookingStatus.PaymentFailed or BookingStatus.Expired)) return BadRequest(new { message = "Booking này không thể thanh toán lại." });
        if (booking.CheckInDate < BookingRules.Today) return BadRequest(new { message = "Ngày nhận phòng đã qua." });
        var roomTypeId = booking.Details.Select(x => x.RoomTypeId).FirstOrDefault();
        var quantity = booking.Details.Sum(x => x.Quantity);
        if (roomTypeId == 0 || quantity < 1) return BadRequest(new { message = "Booking không có thông tin phòng hợp lệ." });

        await AdvisoryLocks.RoomType(db, roomTypeId);
        var roomType = await db.RoomTypes.Include(x => x.Rooms)
            .SingleOrDefaultAsync(x => x.Id == roomTypeId && x.Status == "Active" && x.Homestay.Status == "Approved");
        if (roomType is null) return BadRequest(new { message = "Loại phòng không còn được kinh doanh." });
        var rooms = (await BookingAvailability.AvailableRoomIds(db, roomTypeId, booking.CheckInDate, booking.CheckOutDate, DateTime.UtcNow, booking.Id)).Take(quantity).ToList();
        if (rooms.Count < quantity)
        {
            db.BookingConflictEvents.Add(new BookingConflictEvent { CustomerId = userId, RoomTypeId = roomTypeId,
                CheckInDate = booking.CheckInDate, CheckOutDate = booking.CheckOutDate, RequestedQuantity = quantity,
                AvailableQuantity = rooms.Count, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync(); await transaction.CommitAsync();
            return Conflict(new { message = "Phòng đã được khách khác đặt trong lúc giao dịch trước thất bại." });
        }
        var details = booking.Details.ToList();
        if (details.Count != quantity)
        {
            var template = details[0];
            db.BookingDetails.RemoveRange(details);
            details = rooms.Select(room => new BookingDetail
            {
                BookingId = booking.Id, RoomTypeId = roomTypeId, RoomId = room, Quantity = 1,
                PricePerNight = template.PricePerNight, NumberOfNights = template.NumberOfNights,
                ExtraFee = template.ExtraFee / quantity, LineTotal = template.LineTotal / quantity,
                GuestName = template.GuestName, Note = template.Note
            }).ToList();
            db.BookingDetails.AddRange(details);
        }
        else
            for (var index = 0; index < details.Count; index++) details[index].RoomId = rooms[index];

        await db.BookingRoomStays.Where(x => x.BookingId == booking.Id && x.Status == "Active").ExecuteUpdateAsync(x => x.SetProperty(s => s.Status, "Replaced"));
        foreach (var roomId in rooms) db.BookingRoomStays.Add(new BookingRoomStay { BookingId = booking.Id, RoomId = roomId, StartDate = booking.CheckInDate, EndDate = booking.CheckOutDate, NightlyPrice = details[0].PricePerNight, Status = "Active", CreatedAt = DateTime.UtcNow });

        var now = DateTime.UtcNow;
        var transactionCode = $"{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant();
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "127.0.0.1";
        var paymentUrl = vnPay.CreatePaymentUrl(transactionCode, booking.DepositAmount, $"Thanh toan lai tien coc {booking.BookingCode}", ip, PolicyService.ParseSnapshot(booking.PolicySnapshotJson).HoldMinutes);
        await db.Payments.Where(p => p.BookingId == booking.Id && p.TransactionType == "Deposit" && p.Status == "Pending")
            .ExecuteUpdateAsync(update => update.SetProperty(p => p.Status, "Failed").SetProperty(p => p.UpdatedAt, now));
        db.Payments.Add(new Payment { BookingId = booking.Id, TransactionCode = transactionCode, PaymentMethod = "VNPay", TransactionType = "Deposit", Amount = booking.DepositAmount, Status = "Pending", CreatedAt = now, UpdatedAt = now });
        booking.Status = BookingStatus.Hold;
        booking.HoldExpiresAt = now.AddMinutes(PolicyService.ParseSnapshot(booking.PolicySnapshotJson).HoldMinutes);
        booking.UpdatedAt = now;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { booking.BookingCode, amount = booking.DepositAmount, paymentUrl });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPost("{bookingId:long}/pay-balance")]
    public async Task<IActionResult> PayBalance(long bookingId)
    {
        if (!vnPay.IsConfigured) return StatusCode(503, new { message = "VNPay chưa được cấu hình." });
        await using var transaction = await db.Database.BeginTransactionAsync(); await BookingAvailability.LockBooking(db, bookingId);
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var booking = await db.Bookings.SingleOrDefaultAsync(x => x.Id == bookingId && x.CustomerId == userId);
        if (booking is null) return NotFound();
        if (booking.Status is not (BookingStatus.CheckoutPendingPayment or BookingStatus.CheckedOut)) return Conflict(new { message = "Booking chưa có công nợ được phép thanh toán." });
        if (await db.AdditionalCharges.AnyAsync(x => x.BookingId == bookingId && (x.Status == ChargeStatus.PendingGuestConfirmation || x.Status == ChargeStatus.Disputed)))
            return Conflict(new { message = "Còn khoản hư hại chưa được xử lý." });
        var balance = await paymentService.BalanceDue(booking); if (balance <= 0) return Conflict(new { message = "Booking không còn công nợ." });
        var now = DateTime.UtcNow; var code = $"BAL{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant();
        db.Payments.Add(new Payment { BookingId = bookingId, TransactionCode = code, PaymentMethod = "VNPay", TransactionType = "FinalPayment", Amount = balance, Status = "Pending", CreatedAt = now, UpdatedAt = now });
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "127.0.0.1";
        var paymentUrl = vnPay.CreatePaymentUrl(code, balance, $"Thanh toan cong no {booking.BookingCode}", ip);
        await db.SaveChangesAsync(); await transaction.CommitAsync(); return Ok(new { amount = balance, paymentUrl });
    }

    // Return and IPN share one idempotent, serialized state transition.
    private async Task<(string Code, string Message, string Result, string? BookingCode)> ProcessGatewayResult()
    {
        if (!vnPay.IsConfigured || !vnPay.Validate(Request.Query)) return ("97", "Invalid signature", "invalid", null);
        var transactionCode = Request.Query["vnp_TxnRef"].ToString();
        var bookingId = await db.Payments.Where(p => p.TransactionCode == transactionCode && p.TransactionType != "Refund")
            .Select(p => (long?)p.BookingId).SingleOrDefaultAsync();
        if (bookingId is null) return ("01", "Order not found", "notfound", null);
        await using var transaction = await db.Database.BeginTransactionAsync();
        await BookingAvailability.LockBooking(db, bookingId.Value);
        var payment = await db.Payments.Include(p => p.Booking).SingleAsync(p => p.TransactionCode == transactionCode);
        if (!long.TryParse(Request.Query["vnp_Amount"], out var amount) || amount != decimal.ToInt64(payment.Amount * 100))
            return ("04", "Invalid amount", "invalid", payment.Booking.BookingCode);
        if (payment.Status == "Success")
        {
            var refundQueued = await db.Payments.AnyAsync(p => p.TransactionCode == "RF" + transactionCode);
            return ("02", "Order already processed", refundQueued ? "refund-pending" : payment.Booking.Status is BookingStatus.Confirmed or BookingStatus.CheckedIn or BookingStatus.CheckoutPendingPayment or BookingStatus.CheckedOut ? "success" : "failed", payment.Booking.BookingCode);
        }
        var success = Request.Query["vnp_ResponseCode"] == "00" && Request.Query["vnp_TransactionStatus"] == "00";
        if (payment.Status == "Failed" && !success) return ("02", "Order already processed", "failed", payment.Booking.BookingCode);
        var now = DateTime.UtcNow;
        var isDeposit = payment.TransactionType == "Deposit";
        var canConfirm = isDeposit && BookingRules.CanConfirm(payment.Booking.Status, payment.Booking.HoldExpiresAt ?? payment.Booking.UpdatedAt, payment.CreatedAt, now);
        payment.Status = success ? "Success" : "Failed";
        payment.PaidAt = success ? now : null;
        payment.UpdatedAt = now;
        payment.GatewayResponse = JsonSerializer.Serialize(Request.Query.ToDictionary(x => x.Key, x => x.Value.ToString()));
        payment.VnPayTransactionNo = Request.Query["vnp_TransactionNo"].ToString();
        payment.ResponseCode = Request.Query["vnp_ResponseCode"].ToString();
        payment.BankCode = Request.Query["vnp_BankCode"].ToString();
        var result = success ? "success" : "failed";
        if (canConfirm)
        {
            payment.Booking.Status = success ? BookingStatus.Confirmed : BookingStatus.PaymentFailed;
            payment.Booking.PaymentStatus = success
                ? payment.Amount >= payment.Booking.TotalAmount ? PaymentStatus.Paid : PaymentStatus.Deposited
                : PaymentStatus.Unpaid;
            payment.Booking.UpdatedAt = now;
            if (success && payment.Booking.RecommendationSessionId is not null
                && !await db.RecommendationEvents.AnyAsync(e => e.BookingId == payment.BookingId))
                db.RecommendationEvents.Add(new RecommendationEvent
                {
                    OccurredAt = now,
                    CustomerId = payment.Booking.CustomerId,
                    SessionId = payment.Booking.RecommendationSessionId,
                    EventType = "booking",
                    HomestayId = payment.Booking.HomestayId,
                    BookingId = payment.BookingId,
                    QueryData = "{}",
                    Source = "real"
                });
        }
        else if (isDeposit)
        {
            // A late payment must never reclaim rooms already released or allocated to another guest.
            if (payment.Booking.Status == BookingStatus.Hold && !BookingRules.IsActiveHold(payment.Booking.Status, payment.Booking.HoldExpiresAt ?? payment.Booking.UpdatedAt, now))
            {
                payment.Booking.Status = BookingStatus.Expired;
                payment.Booking.UpdatedAt = now;
            }
            if (success)
            {
                db.Payments.Add(new Payment { BookingId = payment.BookingId, TransactionCode = "RF" + transactionCode,
                    PaymentMethod = "VNPay", TransactionType = "Refund", Amount = payment.Amount, Status = "Pending",
                    GatewayResponse = "Late payment after room hold ended; manual refund reconciliation required",
                    CreatedAt = now, UpdatedAt = now });
                result = "refund-pending";
            }
        }
        else if (success)
        {
            await db.SaveChangesAsync();
            await paymentService.RefreshPaymentStatus(payment.Booking);
            var balance = await paymentService.BalanceDue(payment.Booking);
            if (balance <= 0)
            {
                var completingCheckout = payment.Booking.Status == BookingStatus.CheckoutPendingPayment;
                if (completingCheckout) payment.Booking.Status = BookingStatus.CheckedOut;
                payment.Booking.PaymentStatus = PaymentStatus.Paid; payment.Booking.UpdatedAt = now;
                var invoice = await db.FinalInvoices.SingleOrDefaultAsync(x => x.BookingId == payment.BookingId);
                if (invoice is not null) { invoice.BalanceDue = 0; invoice.Status = "Paid"; invoice.PaidAt = now; }
                await db.AdditionalCharges.Where(x => x.BookingId == payment.BookingId && (x.Status == ChargeStatus.Approved || x.Status == ChargeStatus.Adjusted)).ExecuteUpdateAsync(x => x.SetProperty(c => c.IsPaid, true).SetProperty(c => c.Status, ChargeStatus.Paid));
                if (completingCheckout)
                {
                    await db.BookingRoomStays.Where(x => x.BookingId == payment.BookingId && x.Status == "Active").ExecuteUpdateAsync(x => x.SetProperty(s => s.Status, "Completed"));
                    var roomIds = await db.BookingRoomStays.Where(x => x.BookingId == payment.BookingId).Select(x => x.RoomId).Distinct().ToListAsync();
                    await db.Rooms.Where(x => roomIds.Contains(x.Id)).ExecuteUpdateAsync(x => x.SetProperty(r => r.Status, "Cleaning").SetProperty(r => r.UpdatedAt, now));
                    var checkInOut = await db.CheckInOuts.SingleOrDefaultAsync(x => x.BookingId == payment.BookingId);
                    if (checkInOut is null)
                    {
                        db.CheckInOuts.Add(new CheckInOut
                        {
                            BookingId = payment.BookingId,
                            ActualCheckOutAt = now,
                            Status = "CheckedOut",
                            Note = "Hoàn tất tự động sau khi thanh toán quyết toán qua VNPay."
                        });
                    }
                    else
                    {
                        checkInOut.ActualCheckOutAt = now;
                        checkInOut.Status = "CheckedOut";
                        checkInOut.Note = string.Join(" | ", new[] { checkInOut.Note, "Hoàn tất sau khi thanh toán quyết toán qua VNPay." }.Where(x => !string.IsNullOrWhiteSpace(x)));
                    }
                }
            }
        }
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return ("00", "Confirm Success", result, payment.Booking.BookingCode);
    }

    [AllowAnonymous]
    [HttpGet("vnpay-return")]
    public async Task<IActionResult> VnPayReturn()
    {
        var configuredClientUrl = Environment.GetEnvironmentVariable("CLIENT_URL")?.Trim().TrimEnd('/');
        var clientUrl = string.IsNullOrWhiteSpace(configuredClientUrl) ? "http://localhost:5173" : configuredClientUrl;
        var outcome = await ProcessGatewayResult();
        return Redirect($"{clientUrl}/?payment={outcome.Result}&bookingCode={Uri.EscapeDataString(outcome.BookingCode ?? "")}");
    }

    [AllowAnonymous]
    [HttpGet("vnpay-ipn")]
    public async Task<IActionResult> VnPayIpn()
    {
        var outcome = await ProcessGatewayResult();
        return Ok(new { RspCode = outcome.Code, Message = outcome.Message });
    }
}
