using HomestayAuth.Api.Features.Notifications;
using System.Data;
using System.Security.Claims;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record ManualBookingRequest(long RoomId, DateOnly CheckIn, DateOnly CheckOut, int AdultCount, int ChildCount,
    string GuestName, string GuestEmail, string GuestPhone, string? Note, IReadOnlyList<long>? ServiceIds = null,
    int? TallChildren = null, int? SmallChildren = null);
public sealed record DepositRequest(decimal? Amount, string PaymentMethod = "Manual", string? TransactionCode = null);
public sealed record CheckInRequest(string Notes, object? Evidence = null);
public sealed record ChargeRequest(string Type, string Description, int Quantity, decimal UnitPrice, object? Evidence = null);
public sealed record ChargeDecisionRequest(string? Reason, decimal? AdjustedAmount = null);
public sealed record OverrideCancellationRequest(decimal RefundPercent, string Reason);
public sealed record RoomChangeRequest(long NewRoomId, DateOnly? ChangeDate, string? Reason);
public sealed record DecisionRequest(string? Reason);
public sealed record LateCheckoutRequestDto(DateTime RequestedCheckoutAt);
public sealed record CheckoutRequest(decimal PaymentAmount = 0, string PaymentMethod = "Manual");

[ApiController]
[Route("api")]
[Authorize]
public sealed class BookingOperationsController(AppDbContext db, RoomInventoryService inventory, PaymentService payments, AdditionalChargeService chargeService,
    IdempotencyService idempotency, PolicyService policyService, BookingPricingService pricingService, NotificationService notifications) : ControllerBase
{
    private long UserId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string Role => User.FindFirstValue(ClaimTypes.Role) ?? "Customer";

    [HttpPost("bookings")]
    public async Task<IActionResult> Create(ManualBookingRequest request)
    {
        if (Role != "Host") return Forbid();
        if (BookingRules.ValidateDates(request.CheckIn, request.CheckOut, BookingRules.Today) is { } error) return BadRequest(new { message = error });
        var guestCount = request.AdultCount + request.ChildCount;
        if (request.AdultCount <= 0 || request.ChildCount < 0) return BadRequest(new { message = "Số lượng khách không hợp lệ." });
        if (string.IsNullOrWhiteSpace(request.GuestName) || string.IsNullOrWhiteSpace(request.GuestEmail) || string.IsNullOrWhiteSpace(request.GuestPhone))
            return BadRequest(new { message = "Vui lòng nhập đủ họ tên, email và số điện thoại khách." });
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        await inventory.LockRoom(request.RoomId);
        var room = await db.Rooms.Include(x => x.RoomType).ThenInclude(x => x.PricePeriods)
            .SingleOrDefaultAsync(x => x.Id == request.RoomId && x.Status == "Available" && x.RoomType.Homestay.HostId == UserId);
        if (room is null) return NotFound(new { message = "Phòng không tồn tại hoặc không kinh doanh." });
        // Same occupancy rules as online booking; without a height split the children are charged as from 1.2 m.
        var party = OccupancyRules.FromCounts(request.AdultCount, request.ChildCount, request.TallChildren, request.SmallChildren, null, 12);
        if (party.Children != request.ChildCount) return BadRequest(new { message = "Số trẻ em theo chiều cao không khớp với tổng số trẻ em." });
        var occupancy = OccupancyRules.Evaluate(party, 1, room.RoomType.BaseCapacity, room.RoomType.MaxCapacity, room.RoomType.ExtraGuestAllowed, room.RoomType.MaxExtraChildren);
        if (!occupancy.Ok) return BadRequest(new { message = occupancy.Message });
        if (!await inventory.IsAvailable(room.Id, request.CheckIn, request.CheckOut))
            return Conflict(new { message = "Phòng đã được giữ hoặc đặt trong khoảng thời gian này." });
        var policy = await policyService.Resolve(room.RoomType.HomestayId, DateTime.UtcNow);
        var price = pricingService.Calculate(room.RoomType, request.CheckIn, request.CheckOut, request.AdultCount, request.ChildCount, 1, null,
            "Deposit", room.RoomType.PricePeriods.ToList(), policy, BookingRules.Today, party: party);
        var requestedServiceIds = request.ServiceIds?.Distinct().Take(20).ToArray() ?? [];
        var selectedServices = await db.HomestayServices.AsNoTracking().Where(x => requestedServiceIds.Contains(x.Id) &&
            x.HomestayId == room.RoomType.HomestayId && x.IsActive).ToListAsync();
        var nights = price.Nights;
        var roomAmount = price.RoomAmount;
        var extra = price.ExtraAdultFee;
        var serviceTotal = selectedServices.Sum(x => x.Price);
        var now = DateTime.UtcNow;
        var email = request.GuestEmail.Trim().ToLowerInvariant();
        var phone = request.GuestPhone.Trim();
        var customer = await db.Users.SingleOrDefaultAsync(x => x.Email == email);
        if (customer is not null && customer.Role != "Customer") return Conflict(new { message = "Email này đang thuộc tài khoản không phải khách hàng." });
        // Attaching to an existing account requires both email and phone to match, so a host cannot
        // push bookings into a stranger's account (or learn its profile) just by knowing an email.
        if (customer is not null && NormalizePhone(customer.PhoneNumber) != NormalizePhone(phone))
            return Conflict(new { message = "Email này đã có tài khoản nhưng số điện thoại không khớp. Vui lòng kiểm tra lại thông tin khách." });
        if (customer is null && await db.Users.AnyAsync(x => x.PhoneNumber == phone))
            return Conflict(new { message = "Số điện thoại này đã thuộc một tài khoản khác. Vui lòng kiểm tra lại email khách." });
        if (customer is null)
        {
            customer = new User { FullName = request.GuestName.Trim(), Email = email, PhoneNumber = phone, PasswordHash = null,
                Role = "Customer", Status = "Unverified", CreatedAt = now, UpdatedAt = now };
            db.Users.Add(customer); await db.SaveChangesAsync();
        }
        var booking = new Booking { BookingCode = $"TRP{now:yyMMddHHmmss}{Guid.NewGuid():N}"[..24].ToUpperInvariant(), CustomerId = customer.Id,
            HomestayId = room.RoomType.HomestayId, CheckInDate = request.CheckIn, CheckOutDate = request.CheckOut, AdultCount = request.AdultCount,
            ChildCount = request.ChildCount, TallChildCount = party.TallChildren, SmallChildCount = party.SmallChildren, RoomAmount = roomAmount, DepositAmount = price.DepositAmount,
            Subtotal = price.TotalAmount + serviceTotal, TotalAmount = price.TotalAmount + serviceTotal, DiscountAmount = price.DiscountAmount, ServiceFee = serviceTotal, TaxAmount = 0, CommissionRate = policy.CommissionRate,
            Status = BookingStatus.Hold, PaymentStatus = PaymentStatus.Unpaid, HoldExpiresAt = now.AddMinutes(policy.HoldMinutes), CustomerNote = request.Note,
            ContactName = request.GuestName.Trim(), ContactEmail = email, ContactPhone = phone, GuestName = request.GuestName.Trim(),
            PricingSnapshotJson = JsonSerializer.Serialize(new { room.RoomType.Id, room.RoomType.Name, price }), PolicySnapshotJson = PolicyService.Serialize(policy), ReviewCreateUntil = request.CheckOut.AddDays(policy.ReviewCreateDays), ReviewEditUntil = request.CheckOut.AddDays(policy.ReviewEditDays), CreatedAt = now, UpdatedAt = now };
        booking.Details.Add(new BookingDetail { RoomId = room.Id, RoomTypeId = room.RoomTypeId, Quantity = 1, PricePerNight = price.RoomAmountBeforeDiscount / nights, NumberOfNights = nights, ExtraFee = extra, LineTotal = price.TotalAmount });
        inventory.Allocate(booking, room.Id, request.CheckIn, request.CheckOut, price.RoomAmountBeforeDiscount / nights);
        if (extra > 0) booking.AdditionalCharges.Add(chargeService.Create(0, "extra_guest", "Phụ thu khách vượt sức chứa cơ bản", 1, extra, UserId, null));
        foreach (var service in selectedServices)
            booking.AdditionalCharges.Add(chargeService.Create(0, "service", $"{service.Name} ({service.Unit})", 1, service.Price, UserId, null));
        db.Bookings.Add(booking); await db.SaveChangesAsync(); await tx.CommitAsync();
        return CreatedAtAction(nameof(Balance), new { id = booking.Id }, new { booking.Id, booking.BookingCode, booking.RoomAmount, booking.TotalAmount, booking.DepositAmount, booking.HoldExpiresAt, additionalCharge = extra, serviceTotal });
    }

    [HttpPost("bookings/{id:long}/pay-deposit")]
    public async Task<IActionResult> PayDeposit(long id, DepositRequest request)
    {
        // Manual deposit confirmation is a Host action on bookings of their own homestay only;
        // online bookings must be confirmed by the VNPay callback.
        if (Role != "Host") return Forbid();
        if (await Replay("pay-deposit", request) is { } replay) return replay;
        await using var tx = await db.Database.BeginTransactionAsync(); await BookingAvailability.LockBooking(db, id);
        var booking = await HostBooking(id);
        if (booking is null) return NotFound();
        if (await db.Payments.AnyAsync(x => x.BookingId == id && x.PaymentMethod == "VNPay"))
            return Conflict(new { message = "Đơn đặt online chỉ được xác nhận qua cổng thanh toán VNPay." });
        if (!BookingRules.IsActiveHold(booking.Status, booking.HoldExpiresAt ?? booking.UpdatedAt, DateTime.UtcNow)) return Conflict(new { message = "Thời gian giữ phòng đã hết." });
        var amount = request.Amount ?? booking.DepositAmount;
        if (amount < booking.DepositAmount) return BadRequest(new { message = "Số tiền cọc chưa đủ." });
        db.Payments.Add(new Payment { BookingId = id, TransactionCode = request.TransactionCode ?? $"MAN-{Guid.NewGuid():N}", PaymentMethod = request.PaymentMethod, TransactionType = "Deposit", Amount = amount, Status = "Success", PaidAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        booking.Status = BookingStatus.Confirmed;
        booking.PaymentStatus = amount >= booking.TotalAmount ? PaymentStatus.Paid : PaymentStatus.Deposited;
        booking.UpdatedAt = DateTime.UtcNow;
        notifications.Notify(booking.CustomerId, NotificationTemplates.BookingConfirmed(booking.Id, booking.BookingCode,
            await db.Homestays.Where(h => h.Id == booking.HomestayId).Select(h => h.Name).SingleAsync(), booking.CheckInDate, booking.CheckOutDate));
        var response = new { booking.Status, booking.PaymentStatus, paid = amount }; StoreIdempotency("pay-deposit", request, response);
        await db.SaveChangesAsync(); await tx.CommitAsync(); return Ok(response);
    }

    [HttpPost("bookings/{id:long}/checkin")]
    public async Task<IActionResult> CheckIn(long id, CheckInRequest request)
    {
        if (Role != "Host") return Forbid();
        var booking = await HostBooking(id); if (booking is null) return NotFound();
        if (booking.Status != BookingStatus.Confirmed) return Conflict(new { message = "Chỉ booking đã xác nhận mới được check-in." });
        db.RoomInspections.Add(new RoomInspection { BookingId = id, Notes = request.Notes, EvidenceJson = request.Evidence is null ? null : JsonSerializer.Serialize(request.Evidence), RecordedBy = UserId, CreatedAt = DateTime.UtcNow });
        booking.Status = BookingStatus.CheckedIn; booking.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync(); return Ok(new { booking.Status });
    }

    [HttpPost("bookings/{id:long}/additional-charges")]
    public async Task<IActionResult> AddCharge(long id, ChargeRequest request)
    {
        if (Role != "Host") return Forbid();
        if (request.Quantity <= 0 || request.UnitPrice < 0 || string.IsNullOrWhiteSpace(request.Description)) return BadRequest(new { message = "Khoản phát sinh không hợp lệ." });
        var booking = await HostBooking(id); if (booking is null) return NotFound();
        AdditionalCharge charge;
        try { charge = chargeService.Create(id, request.Type, request.Description, request.Quantity, request.UnitPrice, UserId, request.Evidence is null ? null : JsonSerializer.Serialize(request.Evidence)); }
        catch (ArgumentException exception) { return BadRequest(new { message = exception.Message }); }
        db.AdditionalCharges.Add(charge); AddAudit("additional_charge.created", "Booking", id, new { charge.Type, charge.TotalPrice }, null); await db.SaveChangesAsync();
        return Ok(charge);
    }

    [HttpGet("bookings/{id:long}/balance")]
    public async Task<IActionResult> Balance(long id)
    {
        var booking = await db.Bookings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && (x.CustomerId == UserId || x.Homestay.HostId == UserId)); if (booking is null) return NotFound();
        var charges = await db.AdditionalCharges.Where(x => x.BookingId == id && !x.IsPaid && (x.Status == ChargeStatus.Approved || x.Status == ChargeStatus.Adjusted)).SumAsync(x => (decimal?)x.TotalPrice) ?? 0;
        var paid = await payments.TotalPaid(id); return Ok(new { booking.RoomAmount, unpaidAdditionalCharges = charges, totalPaidBefore = paid, balance = BookingRules.Balance(booking.RoomAmount, charges, paid) });
    }

    [HttpGet("bookings/{id:long}/additional-charges")]
    public async Task<IActionResult> Charges(long id)
    {
        if (!await db.Bookings.AnyAsync(x => x.Id == id && (x.CustomerId == UserId || x.Homestay.HostId == UserId))) return NotFound();
        return Ok(await db.AdditionalCharges.AsNoTracking().Where(x => x.BookingId == id).OrderBy(x => x.CreatedAt)
            .Select(x => new { x.Id, x.Type, x.Description, x.Quantity, x.UnitPrice, x.TotalPrice, x.Status, x.EvidenceJson, x.RecordedBy, x.ReviewedBy, x.ReviewReason, x.ReviewedAt, x.IsPaid, x.CreatedAt }).ToListAsync());
    }

    [HttpPost("bookings/{id:long}/cancel/override")]
    public async Task<IActionResult> OverrideCancellation(long id, OverrideCancellationRequest request)
    {
        if (Role != "Host" || request.RefundPercent is < 0 or > 100 || string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { message = "Tỷ lệ hoặc lý do override không hợp lệ." });
        await using var tx = await db.Database.BeginTransactionAsync(); await BookingAvailability.LockBooking(db, id);
        var booking = await HostBooking(id); if (booking is null) return NotFound(); var paid = await payments.TotalPaid(id);
        var result = BookingRules.Cancellation(paid, booking.CheckInDate.DayNumber - BookingRules.Today.DayNumber, request.RefundPercent);
        var cancellation = await db.Cancellations.SingleOrDefaultAsync(x => x.BookingId == id) ?? new Cancellation { BookingId = id, CancelledBy = UserId, Reason = request.Reason, CancelledAt = DateTime.UtcNow, Status = "Approved" };
        if (cancellation.Id == 0) db.Cancellations.Add(cancellation);
        cancellation.RefundPercent = result.Percent; cancellation.RefundAmount = result.Refund; cancellation.CancellationFee = result.Penalty; cancellation.PaidAmountAtCancellation = paid; cancellation.OverrideBy = UserId; cancellation.OverrideReason = request.Reason; cancellation.ProcessedBy = UserId; cancellation.ProcessedAt = DateTime.UtcNow;
        var alreadyRefundedOrQueued = await db.Payments.Where(x => x.BookingId == id && x.TransactionType == "Refund" && x.Status != "Failed").SumAsync(x => (decimal?)x.Amount) ?? 0;
        if (result.Refund < alreadyRefundedOrQueued) return Conflict(new { message = "Không thể giảm tỷ lệ vì khoản hoàn tiền lớn hơn đã được tạo hoặc xử lý." });
        payments.QueueRefund(id, result.Refund - alreadyRefundedOrQueued, $"Cancellation override: {request.Reason}");
        booking.Status = "Cancelled"; booking.UpdatedAt = DateTime.UtcNow; AddAudit("cancellation.override", "Booking", id, new { result.Percent, result.Refund, result.Penalty }, request.Reason);
        await db.SaveChangesAsync(); await tx.CommitAsync(); return Ok(new { refundAmount = result.Refund, penaltyAmount = result.Penalty });
    }

    [HttpPost("bookings/{id:long}/room-change")]
    public Task<IActionResult> RequestRoomChange(long id, RoomChangeRequest request) => CreateRoomChange(id, request, false);

    [HttpPost("bookings/{id:long}/room-change/owner")]
    public Task<IActionResult> OwnerRoomChange(long id, RoomChangeRequest request) => CreateRoomChange(id, request, true);

    [HttpPost("room-changes/{id:long}/approve")]
    public Task<IActionResult> ApproveRoomChange(long id, DecisionRequest request) => DecideRoomChange(id, true, request.Reason);

    [HttpPost("room-changes/{id:long}/reject")]
    public Task<IActionResult> RejectRoomChange(long id, DecisionRequest request) => DecideRoomChange(id, false, request.Reason);

    [HttpPost("bookings/{id:long}/late-checkout")]
    public async Task<IActionResult> LateCheckout(long id, LateCheckoutRequestDto request)
    {
        var booking = await db.Bookings.Include(x => x.Details).ThenInclude(x => x.Booking).SingleOrDefaultAsync(x => x.Id == id && (x.CustomerId == UserId || x.Homestay.HostId == UserId)); if (booking is null) return NotFound();
        var roomId = booking.Details.Select(x => x.RoomId).FirstOrDefault(); if (roomId is null) return BadRequest(new { message = "Booking chưa được gán phòng." });
        var homestay = await db.Homestays.AsNoTracking().SingleAsync(x => x.Id == booking.HomestayId);
        var planned = booking.CheckOutDate.ToDateTime(homestay.CheckOutTime); var requestedLocal = request.RequestedCheckoutAt.Kind == DateTimeKind.Utc ? TimeZoneInfo.ConvertTimeFromUtc(request.RequestedCheckoutAt, TimeZoneInfo.FindSystemTimeZoneById(homestay.TimeZoneId)) : request.RequestedCheckoutAt; var hours = (int)Math.Ceiling((requestedLocal - planned).TotalHours);
        if (hours <= 0) return BadRequest(new { message = "Giờ trả phòng mới phải muộn hơn giờ quy định." });
        var next = await db.BookingDetails.Where(x => x.RoomId == roomId && x.BookingId != id && BookingRules.ReservedStatuses.Contains(x.Booking.Status) && x.Booking.CheckInDate == booking.CheckOutDate).Select(x => (DateOnly?)x.Booking.CheckInDate).FirstOrDefaultAsync();
        var policy = PolicyService.ParseSnapshot(booking.PolicySnapshotJson); var nightlyPrice = booking.Details.Select(x => x.PricePerNight).FirstOrDefault();
        var fee = PolicyService.LateCheckoutFee(policy, hours * 60, nightlyPrice);
        var nextCheckIn = booking.CheckOutDate.ToDateTime(homestay.CheckInTime); var bufferMinutes = (nextCheckIn - requestedLocal).TotalMinutes;
        var status = next is null && policy.AutoApproveLateCheckoutWithoutNextBooking ? "Approved" : "Pending"; var warning = next is null ? (status == "Pending" ? "Chính sách homestay yêu cầu owner duyệt thủ công." : null) : bufferMinutes < homestay.CleaningBufferMinutes ? $"Chỉ còn {Math.Max(0, (int)bufferMinutes)} phút dọn phòng, thấp hơn buffer {homestay.CleaningBufferMinutes} phút." : $"Có khách nhận cùng ngày; còn {Math.Max(0, (int)bufferMinutes)} phút dọn phòng.";
        var late = new Domain.Entities.LateCheckoutRequest { BookingId = id, RequestedCheckoutAt = request.RequestedCheckoutAt, ExtraHours = hours, Fee = fee, Status = status, Warning = warning, RequestedBy = UserId, ApprovedBy = status == "Approved" ? UserId : null, DecidedAt = status == "Approved" ? DateTime.UtcNow : null, CreatedAt = DateTime.UtcNow };
        db.LateCheckoutRequests.Add(late); if (status == "Approved") db.AdditionalCharges.Add(chargeService.Create(id, "late_checkout", $"Gia hạn trả phòng {hours} giờ", 1, fee, UserId, null));
        await db.SaveChangesAsync(); return Ok(new { late.Id, status, fee, warning });
    }

    [HttpPost("bookings/{id:long}/checkout")]
    public async Task<IActionResult> Checkout(long id, CheckoutRequest request)
    {
        if (Role != "Host") return Forbid(); if (await Replay("checkout", request) is { } replay) return replay; await using var tx = await db.Database.BeginTransactionAsync(); await BookingAvailability.LockBooking(db, id);
        var booking = await HostBooking(id); if (booking is null) return NotFound(); if (booking.Status is not (BookingStatus.CheckedIn or BookingStatus.CheckoutPendingPayment)) return Conflict(new { message = "Booking chưa check-in hoặc không chờ thanh toán checkout." });
        var unresolvedDamage = await db.AdditionalCharges.AnyAsync(x => x.BookingId == id && (x.Status == ChargeStatus.PendingGuestConfirmation || x.Status == ChargeStatus.Disputed));
        if (unresolvedDamage) return Conflict(new { message = "Còn phí hư hại chưa được khách xác nhận hoặc chưa xử lý tranh chấp." });
        var charges = await payments.ApprovedChargeTotal(id); var paidBefore = await payments.TotalPaid(id); var due = BookingRules.Balance(booking.RoomAmount, charges, paidBefore);
        if (request.PaymentAmount < 0 || request.PaymentAmount > Math.Max(0, due)) return BadRequest(new { message = "Số tiền thanh toán không hợp lệ hoặc vượt công nợ." });
        if (request.PaymentAmount > 0) payments.RecordSuccessfulPayment(booking, request.PaymentAmount, request.PaymentMethod, "FinalPayment");
        var remaining = Math.Max(0, due - request.PaymentAmount); var invoice = await db.FinalInvoices.SingleOrDefaultAsync(x => x.BookingId == id);
        if (invoice is null) { invoice = new FinalInvoice { BookingId = id, CreatedAt = DateTime.UtcNow, Status = "Due" }; db.FinalInvoices.Add(invoice); }
        invoice.RoomAmount = booking.RoomAmount; invoice.AdditionalChargesAmount = charges; invoice.TotalPaidBefore = paidBefore + request.PaymentAmount; invoice.BalanceDue = remaining; invoice.Status = remaining == 0 ? "Paid" : "Due"; invoice.PaidAt = remaining == 0 ? DateTime.UtcNow : null;
        booking.Status = remaining == 0 ? BookingStatus.CheckedOut : BookingStatus.CheckoutPendingPayment; booking.PaymentStatus = remaining == 0 ? PaymentStatus.Paid : PaymentStatus.PartiallyPaid; booking.UpdatedAt = DateTime.UtcNow;
        if (remaining == 0) await db.AdditionalCharges.Where(x => x.BookingId == id && (x.Status == ChargeStatus.Approved || x.Status == ChargeStatus.Adjusted)).ExecuteUpdateAsync(x => x.SetProperty(c => c.IsPaid, true).SetProperty(c => c.Status, ChargeStatus.Paid));
        if (remaining == 0)
        {
            await db.BookingRoomStays.Where(x => x.BookingId == id && x.Status == "Active").ExecuteUpdateAsync(x => x.SetProperty(s => s.Status, "Completed"));
            var roomIds = await db.BookingRoomStays.Where(x => x.BookingId == id).Select(x => x.RoomId).Distinct().ToListAsync();
            await db.Rooms.Where(x => roomIds.Contains(x.Id)).ExecuteUpdateAsync(x => x.SetProperty(r => r.Status, "Cleaning").SetProperty(r => r.UpdatedAt, DateTime.UtcNow));
        }
        var response = new { invoice.Id, balanceDue = remaining, booking.Status, booking.PaymentStatus }; StoreIdempotency("checkout", request, response);
        await db.SaveChangesAsync(); await tx.CommitAsync(); return Ok(response);
    }

    [HttpPost("late-checkouts/{id:long}/approve")]
    public Task<IActionResult> ApproveLateCheckout(long id, DecisionRequest request) => DecideLateCheckout(id, true, request.Reason);

    [HttpPost("late-checkouts/{id:long}/reject")]
    public Task<IActionResult> RejectLateCheckout(long id, DecisionRequest request) => DecideLateCheckout(id, false, request.Reason);

    [HttpPost("refunds/{paymentId:long}/confirm")]
    public async Task<IActionResult> ConfirmRefund(long paymentId, DecisionRequest request)
    {
        if (Role != "Host") return Forbid();
        var refund = await db.Payments.Include(x => x.Booking).SingleOrDefaultAsync(x => x.Id == paymentId && x.TransactionType == "Refund" && x.Status == "Pending" && x.Booking.Homestay.HostId == UserId);
        if (refund is null) return NotFound(new { message = "Không tìm thấy khoản hoàn tiền đang chờ." });
        refund.Status = "Success"; refund.PaidAt = DateTime.UtcNow; refund.UpdatedAt = DateTime.UtcNow; refund.GatewayResponse = string.IsNullOrWhiteSpace(request.Reason) ? refund.GatewayResponse : request.Reason;
        await payments.RefreshPaymentStatus(refund.Booking);
        notifications.Notify(refund.Booking.CustomerId, NotificationTemplates.RefundCompleted(refund.BookingId, refund.Booking.BookingCode, refund.Amount));
        AddAudit("refund.confirmed", "Payment", paymentId, new { refund.BookingId, refund.Amount, refund.PaymentMethod }, request.Reason);
        await db.SaveChangesAsync(); return Ok(new { refund.Id, refund.Amount, refund.Status, refund.PaidAt });
    }

    [HttpPost("additional-charges/{id:long}/accept")]
    public async Task<IActionResult> AcceptCharge(long id)
    {
        var charge = await db.AdditionalCharges.Include(x => x.Booking).SingleOrDefaultAsync(x => x.Id == id && x.Booking.CustomerId == UserId && x.Status == ChargeStatus.PendingGuestConfirmation);
        if (charge is null) return NotFound(); charge.Status = ChargeStatus.Approved; charge.ReviewedBy = UserId; charge.ReviewedAt = DateTime.UtcNow;
        AddAudit("additional_charge.accepted", "AdditionalCharge", id, new { charge.TotalPrice }, null); await db.SaveChangesAsync(); return Ok(new { charge.Status });
    }

    [HttpPost("additional-charges/{id:long}/dispute")]
    public async Task<IActionResult> DisputeCharge(long id, DecisionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { message = "Phải nhập lý do tranh chấp." });
        var charge = await db.AdditionalCharges.Include(x => x.Booking).SingleOrDefaultAsync(x => x.Id == id && x.Booking.CustomerId == UserId && x.Status == ChargeStatus.PendingGuestConfirmation);
        if (charge is null) return NotFound(); charge.Status = ChargeStatus.Disputed; charge.ReviewedBy = UserId; charge.ReviewReason = request.Reason.Trim(); charge.ReviewedAt = DateTime.UtcNow;
        AddAudit("additional_charge.disputed", "AdditionalCharge", id, new { charge.TotalPrice }, request.Reason); await db.SaveChangesAsync(); return Ok(new { charge.Status });
    }

    [HttpPost("additional-charges/{id:long}/resolve")]
    public async Task<IActionResult> ResolveCharge(long id, ChargeDecisionRequest request)
    {
        if (Role != "Host" || string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { message = "Owner phải nhập lý do xử lý." });
        var charge = await db.AdditionalCharges.Include(x => x.Booking).SingleOrDefaultAsync(x => x.Id == id && x.Booking.Homestay.HostId == UserId && (x.Status == ChargeStatus.Disputed || x.Status == ChargeStatus.PendingGuestConfirmation));
        if (charge is null) return NotFound();
        if (request.AdjustedAmount is < 0) return BadRequest(new { message = "Số tiền điều chỉnh không hợp lệ." });
        if (request.AdjustedAmount == 0) { charge.TotalPrice = 0; charge.Status = ChargeStatus.Waived; }
        else if (request.AdjustedAmount.HasValue) { charge.TotalPrice = request.AdjustedAmount.Value; charge.Quantity = 1; charge.UnitPrice = request.AdjustedAmount.Value; charge.Status = ChargeStatus.Adjusted; }
        else charge.Status = ChargeStatus.Approved;
        charge.ReviewedBy = UserId; charge.ReviewReason = request.Reason.Trim(); charge.ReviewedAt = DateTime.UtcNow;
        AddAudit("additional_charge.resolved", "AdditionalCharge", id, new { charge.Status, charge.TotalPrice }, request.Reason); await db.SaveChangesAsync(); return Ok(new { charge.Status, charge.TotalPrice });
    }

    private async Task<IActionResult> CreateRoomChange(long bookingId, RoomChangeRequest request, bool owner)
    {
        if (owner && Role != "Host") return Forbid(); if (await Replay(owner ? "owner-room-change" : "guest-room-change", request) is { } replay) return replay; await using var tx = await db.Database.BeginTransactionAsync(); await BookingAvailability.LockBooking(db, bookingId); await inventory.LockRoom(request.NewRoomId);
        var booking = await db.Bookings.Include(x => x.Details).SingleOrDefaultAsync(x => x.Id == bookingId && (owner ? x.Homestay.HostId == UserId : x.CustomerId == UserId)); if (booking is null) return NotFound();
        var detail = booking.Details.SingleOrDefault(); if (detail?.RoomId is null) return BadRequest(new { message = "Chỉ hỗ trợ booking một phòng đã gán phòng." });
        var date = request.ChangeDate ?? BookingRules.Today; if (date < booking.CheckInDate || date >= booking.CheckOutDate) return BadRequest(new { message = "Ngày đổi phòng không hợp lệ." });
        var newRoom = await db.Rooms.Include(x => x.RoomType).SingleOrDefaultAsync(x => x.Id == request.NewRoomId); if (newRoom is null || newRoom.RoomType.HomestayId != booking.HomestayId) return BadRequest(new { message = "Phòng mới không hợp lệ." });
        if (!await inventory.IsAvailable(request.NewRoomId, date, booking.CheckOutDate, bookingId)) return Conflict(new { message = "Phòng mới không trống." });
        var remaining = booking.CheckOutDate.DayNumber - date.DayNumber; var difference = BookingRules.RoomChangeDifference(newRoom.RoomType.BasePrice, detail.PricePerNight, remaining);
        var change = new RoomChangeLog { BookingId = bookingId, OldRoomId = detail.RoomId.Value, NewRoomId = request.NewRoomId, ChangeDate = date, RemainingNights = remaining, PriceDifference = difference, InitiatedBy = owner ? "owner" : "guest", RequestStatus = owner ? "Approved" : "Pending", Reason = request.Reason, RequestedBy = UserId, ApprovedBy = owner ? UserId : null, DecidedAt = owner ? DateTime.UtcNow : null, CreatedAt = DateTime.UtcNow };
        db.RoomChangeLogs.Add(change); if (owner) await ApplyRoomChange(booking, detail, change, newRoom.RoomType.BasePrice, true); var response = new { change.Id, change.RequestStatus, difference }; StoreIdempotency(owner ? "owner-room-change" : "guest-room-change", request, response); await db.SaveChangesAsync(); await tx.CommitAsync(); return Ok(response);
    }

    private async Task<IActionResult> DecideRoomChange(long id, bool approved, string? reason)
    {
        if (Role != "Host") return Forbid(); await using var tx = await db.Database.BeginTransactionAsync();
        var change = await db.RoomChangeLogs.SingleOrDefaultAsync(x => x.Id == id && x.RequestStatus == "Pending"); if (change is null) return NotFound(); await BookingAvailability.LockBooking(db, change.BookingId); await inventory.LockRoom(change.NewRoomId);
        var booking = await db.Bookings.Include(x => x.Details).SingleAsync(x => x.Id == change.BookingId && x.Homestay.HostId == UserId); var detail = booking.Details.Single();
        if (approved && !await inventory.IsAvailable(change.NewRoomId, change.ChangeDate, booking.CheckOutDate, booking.Id)) return Conflict(new { message = "Phòng mới không còn trống." });
        change.RequestStatus = approved ? "Approved" : "Rejected"; change.ApprovedBy = UserId; change.DecidedAt = DateTime.UtcNow; if (!string.IsNullOrWhiteSpace(reason)) change.Reason = reason;
        if (approved) { var newPrice = await db.Rooms.Where(x => x.Id == change.NewRoomId).Select(x => x.RoomType.BasePrice).SingleAsync(); await ApplyRoomChange(booking, detail, change, newPrice, false); } AddAudit(approved ? "room_change.approved" : "room_change.rejected", "RoomChange", id, new { change.RequestStatus }, reason);
        await db.SaveChangesAsync(); await tx.CommitAsync(); return Ok(new { change.RequestStatus });
    }

    private async Task ApplyRoomChange(Booking booking, BookingDetail detail, RoomChangeLog change, decimal newNightlyPrice, bool owner)
    {
        await inventory.ChangeRoom(booking, detail.RoomId!.Value, change.NewRoomId, change.ChangeDate, newNightlyPrice);
        detail.RoomId = change.NewRoomId;
        if (!owner && change.PriceDifference > 0) db.AdditionalCharges.Add(chargeService.Create(booking.Id, "room_upgrade", "Chênh lệch nâng hạng phòng", 1, change.PriceDifference, UserId, null));
        if (change.PriceDifference < 0)
        {
            var policy = PolicyService.ParseSnapshot(booking.PolicySnapshotJson);
            var refundPercent = owner ? 100m : policy.GuestDowngradeRefundMode switch { "Full" => 100m, "Percent" => policy.GuestDowngradeRefundPercent, _ => 0m };
            payments.QueueRefund(booking.Id, decimal.Round(Math.Abs(change.PriceDifference) * refundPercent / 100m, 0), owner ? "Owner initiated room downgrade" : "Guest room downgrade policy");
        }
    }

    private async Task<IActionResult> DecideLateCheckout(long id, bool approved, string? reason)
    {
        if (Role != "Host") return Forbid();
        var request = await db.LateCheckoutRequests.SingleOrDefaultAsync(x => x.Id == id && x.Status == "Pending" && x.Booking.Homestay.HostId == UserId);
        if (request is null) return NotFound();
        request.Status = approved ? "Approved" : "Rejected"; request.ApprovedBy = UserId; request.DecidedAt = DateTime.UtcNow;
        if (approved) db.AdditionalCharges.Add(chargeService.Create(request.BookingId, "late_checkout", $"Gia hạn trả phòng {request.ExtraHours} giờ", 1, request.Fee, UserId, null));
        AddAudit(approved ? "late_checkout.approved" : "late_checkout.rejected", "LateCheckout", id, new { request.Status, request.Fee }, reason);
        await db.SaveChangesAsync(); return Ok(new { request.Status, request.Fee });
    }

    private static string NormalizePhone(string? value)
    {
        var compact = new string((value ?? "").Where(c => char.IsDigit(c) || c == '+').ToArray());
        return compact.StartsWith("+84") ? "0" + compact[3..] : compact;
    }
    private Task<Booking?> HostBooking(long id) => db.Bookings.SingleOrDefaultAsync(x => x.Id == id && x.Homestay.HostId == UserId);
    private async Task<IActionResult?> Replay(string scope, object request)
    {
        if (!Request.Headers.TryGetValue("Idempotency-Key", out var key) || string.IsNullOrWhiteSpace(key)) return null;
        var record = await idempotency.Find(scope, key!, UserId); if (record is null) return null;
        if (record.RequestHash != IdempotencyService.RequestHash(request)) return Conflict(new { message = "Idempotency-Key đã được dùng với nội dung khác." });
        return new ContentResult { StatusCode = record.StatusCode, ContentType = "application/json", Content = record.ResponseJson };
    }
    private void StoreIdempotency(string scope, object request, object response)
    {
        if (Request.Headers.TryGetValue("Idempotency-Key", out var key) && !string.IsNullOrWhiteSpace(key)) idempotency.Store(scope, key!, UserId, request, 200, response);
    }
    private void AddAudit(string action, string targetType, long targetId, object after, string? reason) => db.AuditLogs.Add(new AuditLog { ActorId = UserId, ActorRole = Role, Action = action, TargetType = targetType, TargetId = targetId.ToString(), AfterJson = JsonSerializer.Serialize(after), Reason = reason, Ip = HttpContext.Connection.RemoteIpAddress, CreatedAt = DateTime.UtcNow });
}

[ApiController]
[Route("api/rooms")]
public sealed class RoomAvailabilityController(AppDbContext db) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("availability")]
    public async Task<IActionResult> Availability([FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        if (BookingRules.ValidateDates(from, to, BookingRules.Today) is { } error) return BadRequest(new { message = error });
        var blocked = BookingAvailability.BlockingDetails(db, from, to, DateTime.UtcNow).Where(x => x.RoomId != null).Select(x => x.RoomId!.Value);
        return Ok(await db.Rooms.AsNoTracking().Where(x => x.Status == "Available" && !blocked.Contains(x.Id)).Select(x => new { x.Id, x.RoomNumber, x.RoomTypeId, x.RoomType.Name, x.RoomType.BasePrice }).ToListAsync());
    }
}
