using System.Security.Claims;
using System.Text.Json;
using System.Data;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record CreateBookingRequest(long RoomTypeId, DateOnly CheckInDate, DateOnly CheckOutDate, int AdultCount, int ChildCount, int Quantity, string? CustomerNote, string? RecommendationSessionId = null);
public sealed record CancelBookingRequest(string Reason);

[ApiController]
[Route("api/bookings")]
public sealed class BookingsController(AppDbContext db, VnPayService vnPay) : ControllerBase
{
    private static object CancellationQuote(Booking booking, decimal paidAmount)
    {
        var daysBeforeCheckIn = booking.CheckInDate.DayNumber - BookingRules.Today.DayNumber;
        var rate = daysBeforeCheckIn >= 7 ? 0m : .5m;
        var fee = decimal.Round(paidAmount * rate, 0);
        return new { booking.Id, booking.BookingCode, daysBeforeCheckIn, isFree = rate == 0, cancellationFee = fee, refundAmount = paidAmount - fee, policy = rate == 0 ? "Miễn phí hủy trước ngày nhận phòng ít nhất 7 ngày." : "Hủy trong vòng 7 ngày trước nhận phòng: phí hủy 50% số tiền đã thanh toán." };
    }

    [AllowAnonymous]
    [HttpPost("quote")]
    public async Task<IActionResult> Quote(CreateBookingRequest request)
    {
        if (request.CheckOutDate <= request.CheckInDate || request.CheckInDate < BookingRules.Today)
            return BadRequest(new { message = "Ngày nhận hoặc trả phòng không hợp lệ." });
        if (BookingRules.ValidateGuests(request.AdultCount, request.ChildCount, request.Quantity) is not null)
            return BadRequest(new { message = "Số khách hoặc số phòng không hợp lệ." });
        var roomType = await db.RoomTypes.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.RoomTypeId && x.Status == "Active" && x.Homestay.Status == "Approved");
        if (roomType is null) return NotFound(new { message = "Không tìm thấy loại phòng đang kinh doanh." });
        var guestCount = request.AdultCount + request.ChildCount;
        var allowedCapacity = (roomType.ExtraGuestAllowed ? roomType.MaxCapacity : roomType.BaseCapacity) * request.Quantity;
        if (guestCount > allowedCapacity)
            return BadRequest(new { message = "Tổng số khách vượt quá sức chứa của phòng." });
        var available = (await BookingAvailability.AvailableRoomIds(db, roomType.Id, request.CheckInDate, request.CheckOutDate, DateTime.UtcNow)).Count;
        if (available < request.Quantity)
        {
            db.BookingConflictEvents.Add(new BookingConflictEvent { CustomerId = long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId) ? customerId : null,
                RoomTypeId = request.RoomTypeId, CheckInDate = request.CheckInDate, CheckOutDate = request.CheckOutDate,
                RequestedQuantity = request.Quantity, AvailableQuantity = available, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return Conflict(new { message = "Không còn đủ phòng trong khoảng ngày đã chọn." });
        }
        var nights = request.CheckOutDate.DayNumber - request.CheckInDate.DayNumber;
        var periods = await db.RoomPricePeriods.AsNoTracking().Where(x => x.RoomTypeId == roomType.Id && x.StartDate < request.CheckOutDate && x.EndDate >= request.CheckInDate).ToListAsync();
        decimal priceForStay = 0;
        for (var date = request.CheckInDate; date < request.CheckOutDate; date = date.AddDays(1))
            priceForStay += periods.Where(x => x.StartDate <= date && x.EndDate >= date).Select(x => (decimal?)x.PricePerNight).FirstOrDefault() ?? roomType.BasePrice;
        var includedGuests = roomType.BaseCapacity * request.Quantity;
        var extraGuestCount = Math.Max(0, guestCount - includedGuests);
        var roomTotal = priceForStay * request.Quantity;
        var extraGuestFee = BookingRules.ExtraFee(guestCount, roomType.BaseCapacity, request.Quantity, roomType.ExtraGuestFee, nights);
        return Ok(new { nights, quantity = request.Quantity, roomTotal, extraGuestCount, extraGuestFee, extraFee = extraGuestFee, total = roomTotal + extraGuestFee, availableRooms = available });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine()
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var items = await db.Bookings.AsNoTracking().Where(x => x.CustomerId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.BookingCode, x.HomestayId, HomestayName = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.Name).First(),
                HomestayImage = db.HomestayImages.Where(i => i.HomestayId == x.HomestayId).OrderByDescending(i => i.IsThumbnail).ThenBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                Address = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.AddressLine + ", " + h.District + ", " + h.Province).First(),
                HostPhone = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => db.Users.Where(u => u.Id == h.HostId).Select(u => u.PhoneNumber).FirstOrDefault()).FirstOrDefault(),
                x.CheckInDate, x.CheckOutDate, Nights = x.Details.Select(d => (int?)d.NumberOfNights).FirstOrDefault() ?? 0, x.AdultCount, x.ChildCount, x.TotalAmount,
                Rooms = x.Details.Select(d => d.RoomId == null ? db.RoomTypes.Where(t => t.Id == d.RoomTypeId).Select(t => t.Name).First() : db.Rooms.Where(r => r.Id == d.RoomId).Select(r => r.RoomNumber).First()).ToList(),
                Status = x.Status == "PendingPayment" && x.UpdatedAt <= DateTime.UtcNow.AddMinutes(-15) ? "Expired" : x.Status, x.CreatedAt,
                CanReview = x.Status == "Completed" && x.CheckOutDate.AddDays(14) >= BookingRules.Today && !db.Reviews.Any(r => r.BookingId == x.Id),
                Review = db.Reviews.Where(r => r.BookingId == x.Id).Select(r => new { r.Id, r.Rating, r.Comment, r.CleanlinessRating, r.LocationRating, r.HostRating, r.ValueRating, r.HostReply, r.HostRepliedAt, r.CreatedAt, CanEdit = x.CheckOutDate.AddDays(14) >= BookingRules.Today }).FirstOrDefault(),
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
            .Select(x => new { x.Id, x.BookingCode, x.HomestayId, HomestayName = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.Name).First(),
                Address = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.AddressLine + ", " + h.Ward + ", " + h.District + ", " + h.Province).First(),
                CheckInTime = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.CheckInTime).First(), CheckOutTime = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.CheckOutTime).First(),
                HostName = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => db.Users.Where(u => u.Id == h.HostId).Select(u => u.FullName).First()).First(),
                HostPhone = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => db.Users.Where(u => u.Id == h.HostId).Select(u => u.PhoneNumber).FirstOrDefault()).FirstOrDefault(),
                x.CheckInDate, x.CheckOutDate, x.AdultCount, x.ChildCount, x.Subtotal, x.DiscountAmount, x.ServiceFee, x.TaxAmount, x.TotalAmount, x.Status, x.CustomerNote, x.CreatedAt,
                Details = x.Details.Select(d => new { d.Id, d.RoomTypeId, RoomTypeName = db.RoomTypes.Where(r => r.Id == d.RoomTypeId).Select(r => r.Name).First(), d.RoomId, RoomNumber = d.RoomId == null ? null : db.Rooms.Where(r => r.Id == d.RoomId).Select(r => r.RoomNumber).FirstOrDefault(), d.Quantity, d.PricePerNight, d.NumberOfNights, d.ExtraFee, d.LineTotal, d.GuestName, d.Note }).ToList(),
                Payments = x.Payments.OrderByDescending(p => p.CreatedAt).Select(p => new { p.Id, p.PaymentMethod, p.TransactionType, p.Amount, p.Status, p.PaidAt, p.CreatedAt }).ToList(),
                Cancellation = db.Cancellations.Where(c => c.BookingId == x.Id).Select(c => new { c.Reason, c.CancellationFee, c.RefundAmount, c.Status, c.CancelledAt }).FirstOrDefault() })
            .SingleOrDefaultAsync();
        return item is null ? NotFound(new { message = "Không tìm thấy đơn đặt phòng." }) : Ok(item);
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpGet("{bookingId:long}/cancellation-quote")]
    public async Task<IActionResult> GetCancellationQuote(long bookingId)
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var booking = await db.Bookings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == bookingId && x.CustomerId == userId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        if (!BookingRules.CanCancel(booking.Status, booking.UpdatedAt, booking.CheckInDate, BookingRules.Today, DateTime.UtcNow)) return BadRequest(new { message = "Đơn này không còn đủ điều kiện hủy." });
        var paid = await db.Payments.Where(x => x.BookingId == bookingId && x.TransactionType == "Payment" && x.Status == "Success").SumAsync(x => (decimal?)x.Amount) ?? 0;
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
        if (!BookingRules.CanCancel(booking.Status, booking.UpdatedAt, booking.CheckInDate, BookingRules.Today, DateTime.UtcNow)) return BadRequest(new { message = "Đơn này không còn đủ điều kiện hủy." });
        if (await db.Cancellations.AnyAsync(x => x.BookingId == bookingId)) return Conflict(new { message = "Đơn đã có yêu cầu hủy." });
        var paid = await db.Payments.Where(x => x.BookingId == bookingId && x.TransactionType == "Payment" && x.Status == "Success").SumAsync(x => (decimal?)x.Amount) ?? 0;
        var days = booking.CheckInDate.DayNumber - BookingRules.Today.DayNumber;
        var fee = days >= 7 ? 0 : decimal.Round(paid * .5m, 0);
        var requiresApproval = paid > 0;
        db.Cancellations.Add(new Cancellation { BookingId = booking.Id, CancelledBy = userId, Reason = reason, CancelledAt = DateTime.UtcNow, CancellationFee = fee, RefundAmount = paid - fee, Status = requiresApproval ? "Requested" : "Approved", ProcessedAt = requiresApproval ? null : DateTime.UtcNow });
        booking.Status = requiresApproval ? "CancellationRequested" : "Cancelled"; booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { message = requiresApproval ? "Đã gửi yêu cầu hủy và hoàn tiền cho Host xử lý." : "Đã hủy booking chưa thanh toán.", cancellationFee = fee, refundAmount = paid - fee });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPost("vnpay")]
    public async Task<IActionResult> CreateVnPayPayment(CreateBookingRequest request)
    {
        if (!vnPay.IsConfigured) return StatusCode(503, new { message = "VNPay chưa được cấu hình. Vui lòng thêm VNPAY_TMN_CODE và VNPAY_HASH_SECRET." });
        if (request.CheckInDate < BookingRules.Today || request.CheckOutDate <= request.CheckInDate)
            return BadRequest(new { message = "Ngày nhận hoặc trả phòng không hợp lệ." });
        if (BookingRules.ValidateGuests(request.AdultCount, request.ChildCount, request.Quantity) is not null) return BadRequest(new { message = "Số khách hoặc số phòng không hợp lệ." });

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
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock({0})", request.RoomTypeId);

        var roomType = await db.RoomTypes.Include(x => x.Rooms)
            .SingleOrDefaultAsync(x => x.Id == request.RoomTypeId && x.Status == "Active" && x.Homestay.Status == "Approved");
        if (roomType is null) return NotFound(new { message = "Loại phòng không tồn tại hoặc Homestay chưa được duyệt." });
        var guestCount = request.AdultCount + request.ChildCount;
        var allowedCapacity = (roomType.ExtraGuestAllowed ? roomType.MaxCapacity : roomType.BaseCapacity) * request.Quantity;
        if (guestCount > allowedCapacity)
            return BadRequest(new { message = "Tổng số khách vượt quá sức chứa của phòng." });

        var allocatableRooms = (await BookingAvailability.AvailableRoomIds(db, roomType.Id, request.CheckInDate, request.CheckOutDate, DateTime.UtcNow)).Take(request.Quantity).ToList();
        if (allocatableRooms.Count < request.Quantity)
        {
            db.BookingConflictEvents.Add(new BookingConflictEvent { CustomerId = userId, RoomTypeId = request.RoomTypeId,
                CheckInDate = request.CheckInDate, CheckOutDate = request.CheckOutDate, RequestedQuantity = request.Quantity,
                AvailableQuantity = allocatableRooms.Count, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync(); await transaction.CommitAsync();
            return Conflict(new { message = "Loại phòng này đã hết phòng trong khoảng ngày bạn chọn." });
        }

        var nights = request.CheckOutDate.DayNumber - request.CheckInDate.DayNumber;
        var includedGuests = roomType.BaseCapacity * request.Quantity;
        var extraGuestCount = Math.Max(0, guestCount - includedGuests);
        var extraFee = BookingRules.ExtraFee(guestCount, roomType.BaseCapacity, request.Quantity, roomType.ExtraGuestFee, nights);
        var specialPrices = await db.RoomPricePeriods.AsNoTracking().Where(x => x.RoomTypeId == roomType.Id && x.StartDate < request.CheckOutDate && x.EndDate >= request.CheckInDate).ToListAsync();
        decimal priceForStay = 0;
        for (var date = request.CheckInDate; date < request.CheckOutDate; date = date.AddDays(1))
            priceForStay += specialPrices.Where(x => x.StartDate <= date && x.EndDate >= date).Select(x => (decimal?)x.PricePerNight).FirstOrDefault() ?? roomType.BasePrice;
        var roomTotal = priceForStay * request.Quantity;
        var subtotal = roomTotal + extraFee;
        var now = DateTime.UtcNow;
        var bookingCode = $"TRP{now:yyMMddHHmmss}{Guid.NewGuid():N}"[..24].ToUpperInvariant();
        var transactionCode = $"{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant();
        var commissionRate = decimal.TryParse(Environment.GetEnvironmentVariable("PLATFORM_COMMISSION_RATE"), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var configuredRate) ? Math.Clamp(configuredRate, 0m, 1m) : .10m;
        var booking = new Booking { BookingCode = bookingCode, CustomerId = userId, HomestayId = roomType.HomestayId, CheckInDate = request.CheckInDate, CheckOutDate = request.CheckOutDate, AdultCount = request.AdultCount, ChildCount = request.ChildCount, Subtotal = subtotal, DiscountAmount = 0, ServiceFee = 0, TaxAmount = 0, TotalAmount = subtotal, CommissionRate = commissionRate, Status = "PendingPayment", CustomerNote = request.CustomerNote, RecommendationSessionId = recommendationSessionId, CreatedAt = now, UpdatedAt = now };
        var perRoomExtraFee = extraFee / request.Quantity;
        var perRoomLineTotal = subtotal / request.Quantity;
        foreach (var room in allocatableRooms)
            booking.Details.Add(new BookingDetail { RoomTypeId = roomType.Id, RoomId = room, Quantity = 1, PricePerNight = priceForStay / nights, NumberOfNights = nights, ExtraFee = perRoomExtraFee, LineTotal = perRoomLineTotal });
        booking.Payments.Add(new Payment { TransactionCode = transactionCode, PaymentMethod = "VNPay", TransactionType = "Payment", Amount = subtotal, Status = "Pending", CreatedAt = now, UpdatedAt = now });
        db.Bookings.Add(booking);
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "127.0.0.1";
        var paymentUrl = vnPay.CreatePaymentUrl(transactionCode, subtotal, $"Thanh toan dat phong {bookingCode}", ip);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { bookingCode, amount = subtotal, paymentUrl, priceBreakdown = new { roomTotal, extraGuestCount, extraGuestFee = extraFee, extraFee } });
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
        if (booking.Status is not ("PendingPayment" or "PaymentFailed" or "Expired")) return BadRequest(new { message = "Booking này không thể thanh toán lại." });
        if (booking.CheckInDate < BookingRules.Today) return BadRequest(new { message = "Ngày nhận phòng đã qua." });
        var roomTypeId = booking.Details.Select(x => x.RoomTypeId).FirstOrDefault();
        var quantity = booking.Details.Sum(x => x.Quantity);
        if (roomTypeId == 0 || quantity < 1) return BadRequest(new { message = "Booking không có thông tin phòng hợp lệ." });

        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock({0})", roomTypeId);
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

        var now = DateTime.UtcNow;
        var transactionCode = $"{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant();
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "127.0.0.1";
        var paymentUrl = vnPay.CreatePaymentUrl(transactionCode, booking.TotalAmount, $"Thanh toan lai dat phong {booking.BookingCode}", ip);
        await db.Payments.Where(p => p.BookingId == booking.Id && p.TransactionType == "Payment" && p.Status == "Pending")
            .ExecuteUpdateAsync(update => update.SetProperty(p => p.Status, "Failed").SetProperty(p => p.UpdatedAt, now));
        db.Payments.Add(new Payment { BookingId = booking.Id, TransactionCode = transactionCode, PaymentMethod = "VNPay", TransactionType = "Payment", Amount = booking.TotalAmount, Status = "Pending", CreatedAt = now, UpdatedAt = now });
        booking.Status = "PendingPayment";
        booking.UpdatedAt = now;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { booking.BookingCode, amount = booking.TotalAmount, paymentUrl });
    }

    // Return and IPN share one idempotent, serialized state transition.
    private async Task<(string Code, string Message, string Result, string? BookingCode)> ProcessGatewayResult()
    {
        if (!vnPay.IsConfigured || !vnPay.Validate(Request.Query)) return ("97", "Invalid signature", "invalid", null);
        var transactionCode = Request.Query["vnp_TxnRef"].ToString();
        var bookingId = await db.Payments.Where(p => p.TransactionCode == transactionCode && p.TransactionType == "Payment")
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
            return ("02", "Order already processed", refundQueued ? "refund-pending" : payment.Booking.Status is "Confirmed" or "CheckedIn" or "Completed" ? "success" : "failed", payment.Booking.BookingCode);
        }
        var success = Request.Query["vnp_ResponseCode"] == "00" && Request.Query["vnp_TransactionStatus"] == "00";
        if (payment.Status == "Failed" && !success) return ("02", "Order already processed", "failed", payment.Booking.BookingCode);
        var now = DateTime.UtcNow;
        var canConfirm = BookingRules.CanConfirm(payment.Booking.Status, payment.Booking.UpdatedAt, payment.CreatedAt, now);
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
            payment.Booking.Status = success ? "Confirmed" : "PaymentFailed";
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
        else
        {
            // A late payment must never reclaim rooms already released or allocated to another guest.
            if (payment.Booking.Status == "PendingPayment" && !BookingRules.IsActiveHold(payment.Booking.Status, payment.Booking.UpdatedAt, now))
            {
                payment.Booking.Status = "Expired";
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
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return ("00", "Confirm Success", result, payment.Booking.BookingCode);
    }

    [AllowAnonymous]
    [HttpGet("vnpay-return")]
    public async Task<IActionResult> VnPayReturn()
    {
        var clientUrl = Environment.GetEnvironmentVariable("CLIENT_URL") ?? "http://localhost:5173";
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
