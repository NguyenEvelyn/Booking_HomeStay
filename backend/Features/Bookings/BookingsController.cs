using System.Security.Claims;
using System.Text.Json;
using System.Data;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record CreateBookingRequest(long RoomTypeId, DateOnly CheckInDate, DateOnly CheckOutDate, int AdultCount, int ChildCount, int Quantity, string? CustomerNote);
public sealed record CancelBookingRequest(string Reason);

[ApiController]
[Route("api/bookings")]
public sealed class BookingsController(AppDbContext db, VnPayService vnPay) : ControllerBase
{
    private const decimal ExtraAdultFeePerNight = 150_000m;
    private const decimal ChildFeePerNight = 100_000m;
    private static object CancellationQuote(Booking booking, decimal paidAmount)
    {
        var daysBeforeCheckIn = booking.CheckInDate.DayNumber - DateOnly.FromDateTime(DateTime.UtcNow).DayNumber;
        var rate = daysBeforeCheckIn >= 7 ? 0m : .5m;
        var fee = decimal.Round(paidAmount * rate, 0);
        return new { booking.Id, booking.BookingCode, daysBeforeCheckIn, isFree = rate == 0, cancellationFee = fee, refundAmount = paidAmount - fee, policy = rate == 0 ? "Miễn phí hủy trước ngày nhận phòng ít nhất 7 ngày." : "Hủy trong vòng 7 ngày trước nhận phòng: phí hủy 50% số tiền đã thanh toán." };
    }

    [AllowAnonymous]
    [HttpPost("quote")]
    public async Task<IActionResult> Quote(CreateBookingRequest request)
    {
        if (request.CheckOutDate <= request.CheckInDate || request.CheckInDate < DateOnly.FromDateTime(DateTime.UtcNow))
            return BadRequest(new { message = "Ngày nhận hoặc trả phòng không hợp lệ." });
        if (request.AdultCount < 1 || request.ChildCount < 0 || request.Quantity < 1 || request.Quantity > 10)
            return BadRequest(new { message = "Số khách hoặc số phòng không hợp lệ." });
        var roomType = await db.RoomTypes.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.RoomTypeId && x.Status == "Active" && x.Homestay.Status == "Approved");
        if (roomType is null) return NotFound(new { message = "Không tìm thấy loại phòng đang kinh doanh." });
        if (request.AdultCount > roomType.MaxAdults * request.Quantity || request.ChildCount > roomType.MaxChildren * request.Quantity)
            return BadRequest(new { message = "Số khách vượt quá sức chứa của phòng." });
        var holdCutoff = DateTime.UtcNow.AddMinutes(-15);
        var available = await db.Rooms.CountAsync(x => x.RoomTypeId == roomType.Id && x.Status == "Available");
        var reserved = await db.BookingDetails.Where(x => x.RoomTypeId == roomType.Id && x.Booking.CheckInDate < request.CheckOutDate && x.Booking.CheckOutDate > request.CheckInDate
            && (x.Booking.Status == "Confirmed" || x.Booking.Status == "CheckedIn" || (x.Booking.Status == "PendingPayment" && x.Booking.CreatedAt >= holdCutoff))).SumAsync(x => (int?)x.Quantity) ?? 0;
        if (available - reserved < request.Quantity) return Conflict(new { message = "Không còn đủ phòng trong khoảng ngày đã chọn." });
        var nights = request.CheckOutDate.DayNumber - request.CheckInDate.DayNumber;
        var periods = await db.RoomPricePeriods.AsNoTracking().Where(x => x.RoomTypeId == roomType.Id && x.StartDate < request.CheckOutDate && x.EndDate >= request.CheckInDate).ToListAsync();
        decimal priceForStay = 0;
        for (var date = request.CheckInDate; date < request.CheckOutDate; date = date.AddDays(1))
            priceForStay += periods.Where(x => x.StartDate <= date && x.EndDate >= date).Select(x => (decimal?)x.PricePerNight).FirstOrDefault() ?? roomType.BasePrice;
        var includedAdults = Math.Min(2, roomType.MaxAdults) * request.Quantity;
        var extraAdultCount = Math.Max(0, request.AdultCount - includedAdults);
        var roomTotal = priceForStay * request.Quantity;
        var extraAdultFee = extraAdultCount * ExtraAdultFeePerNight * nights;
        var childFee = request.ChildCount * ChildFeePerNight * nights;
        return Ok(new { nights, quantity = request.Quantity, roomTotal, extraAdultCount, childCount = request.ChildCount, extraAdultFee, childFee, extraFee = extraAdultFee + childFee, total = roomTotal + extraAdultFee + childFee, availableRooms = available - reserved });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine()
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var items = await db.Bookings.AsNoTracking().Where(x => x.CustomerId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.BookingCode, x.HomestayId, HomestayName = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.Name).First(), x.CheckInDate, x.CheckOutDate, x.AdultCount, x.ChildCount, x.TotalAmount, x.Status, x.CreatedAt, CanReview = x.Status == "Completed" && !db.Reviews.Any(r => r.BookingId == x.Id) })
            .ToListAsync();
        return Ok(new { items });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpGet("{bookingId:long}")]
    public async Task<IActionResult> GetDetail(long bookingId)
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var item = await db.Bookings.AsNoTracking().Where(x => x.Id == bookingId && x.CustomerId == userId)
            .Select(x => new { x.Id, x.BookingCode, x.HomestayId, HomestayName = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.Name).First(), x.CheckInDate, x.CheckOutDate, x.AdultCount, x.ChildCount, x.Subtotal, x.DiscountAmount, x.ServiceFee, x.TaxAmount, x.TotalAmount, x.Status, x.CustomerNote, x.CreatedAt,
                Details = x.Details.Select(d => new { d.Id, d.RoomTypeId, RoomTypeName = db.RoomTypes.Where(r => r.Id == d.RoomTypeId).Select(r => r.Name).First(), d.RoomId, d.Quantity, d.PricePerNight, d.NumberOfNights, d.ExtraFee, d.LineTotal, d.GuestName, d.Note }).ToList() })
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
        if (booking.Status is not ("Confirmed" or "PendingPayment") || booking.CheckInDate <= DateOnly.FromDateTime(DateTime.UtcNow)) return BadRequest(new { message = "Đơn này không còn đủ điều kiện hủy." });
        var paid = await db.Payments.Where(x => x.BookingId == bookingId && x.TransactionType == "Payment" && x.Status == "Success").SumAsync(x => (decimal?)x.Amount) ?? 0;
        return Ok(CancellationQuote(booking, paid));
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPost("{bookingId:long}/cancel")]
    public async Task<IActionResult> Cancel(long bookingId, CancelBookingRequest request)
    {
        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 500) return BadRequest(new { message = "Vui lòng nhập lý do hủy, tối đa 500 ký tự." });
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var booking = await db.Bookings.SingleOrDefaultAsync(x => x.Id == bookingId && x.CustomerId == userId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        if (booking.Status is not ("Confirmed" or "PendingPayment") || booking.CheckInDate <= DateOnly.FromDateTime(DateTime.UtcNow)) return BadRequest(new { message = "Đơn này không còn đủ điều kiện hủy." });
        if (await db.Cancellations.AnyAsync(x => x.BookingId == bookingId)) return Conflict(new { message = "Đơn đã có yêu cầu hủy." });
        var paid = await db.Payments.Where(x => x.BookingId == bookingId && x.TransactionType == "Payment" && x.Status == "Success").SumAsync(x => (decimal?)x.Amount) ?? 0;
        var days = booking.CheckInDate.DayNumber - DateOnly.FromDateTime(DateTime.UtcNow).DayNumber;
        var fee = days >= 7 ? 0 : decimal.Round(paid * .5m, 0);
        var requiresApproval = paid > 0;
        db.Cancellations.Add(new Cancellation { BookingId = booking.Id, CancelledBy = userId, Reason = reason, CancelledAt = DateTime.UtcNow, CancellationFee = fee, RefundAmount = paid - fee, Status = requiresApproval ? "Requested" : "Approved", ProcessedAt = requiresApproval ? null : DateTime.UtcNow });
        booking.Status = requiresApproval ? "CancellationRequested" : "Cancelled"; booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = requiresApproval ? "Đã gửi yêu cầu hủy và hoàn tiền cho Host xử lý." : "Đã hủy booking chưa thanh toán.", cancellationFee = fee, refundAmount = paid - fee });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPost("vnpay")]
    public async Task<IActionResult> CreateVnPayPayment(CreateBookingRequest request)
    {
        if (!vnPay.IsConfigured) return StatusCode(503, new { message = "VNPay chưa được cấu hình. Vui lòng thêm VNPAY_TMN_CODE và VNPAY_HASH_SECRET." });
        if (request.CheckInDate < DateOnly.FromDateTime(DateTime.Today) || request.CheckOutDate <= request.CheckInDate)
            return BadRequest(new { message = "Ngày nhận hoặc trả phòng không hợp lệ." });
        if (request.AdultCount < 1 || request.ChildCount < 0 || request.Quantity < 1 || request.Quantity > 10) return BadRequest(new { message = "Số khách hoặc số phòng không hợp lệ." });

        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var holdCutoff = DateTime.UtcNow.AddMinutes(-15);
        await db.Bookings.Where(x => x.Status == "PendingPayment" && x.CreatedAt < holdCutoff)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Status, "Expired").SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
        await db.Payments.Where(x => x.Status == "Pending" && x.CreatedAt < holdCutoff)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Status, "Failed").SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock({0})", request.RoomTypeId);

        var roomType = await db.RoomTypes.Include(x => x.Rooms)
            .SingleOrDefaultAsync(x => x.Id == request.RoomTypeId && x.Status == "Active" && x.Homestay.Status == "Approved");
        if (roomType is null) return NotFound(new { message = "Loại phòng không tồn tại hoặc Homestay chưa được duyệt." });
        if (request.AdultCount > roomType.MaxAdults * request.Quantity || request.ChildCount > roomType.MaxChildren * request.Quantity)
            return BadRequest(new { message = "Số khách vượt quá sức chứa của phòng." });

        var blockingStatuses = new[] { "PendingPayment", "Confirmed", "CheckedIn" };
        var overlappingDetails = await db.BookingDetails.AsNoTracking().Where(detail =>
            detail.RoomTypeId == request.RoomTypeId &&
            detail.Booking.CheckInDate < request.CheckOutDate && detail.Booking.CheckOutDate > request.CheckInDate &&
            blockingStatuses.Contains(detail.Booking.Status)).Select(detail => new { detail.RoomId, detail.Quantity }).ToListAsync();
        var assignedRoomIds = overlappingDetails.Where(x => x.RoomId.HasValue).Select(x => x.RoomId!.Value).ToHashSet();
        var legacyUnassignedCount = overlappingDetails.Where(x => !x.RoomId.HasValue).Sum(x => x.Quantity);
        var allocatableRooms = roomType.Rooms.Where(x => x.Status == "Available" && !assignedRoomIds.Contains(x.Id))
            .OrderBy(x => x.RoomNumber).Skip(legacyUnassignedCount).Take(request.Quantity).ToList();
        if (allocatableRooms.Count < request.Quantity)
            return Conflict(new { message = "Loại phòng này đã hết phòng trong khoảng ngày bạn chọn." });

        var nights = request.CheckOutDate.DayNumber - request.CheckInDate.DayNumber;
        var includedAdults = Math.Min(2, roomType.MaxAdults) * request.Quantity;
        var extraAdultCount = Math.Max(0, request.AdultCount - includedAdults);
        var extraFee = (extraAdultCount * ExtraAdultFeePerNight + request.ChildCount * ChildFeePerNight) * nights;
        var specialPrices = await db.RoomPricePeriods.AsNoTracking().Where(x => x.RoomTypeId == roomType.Id && x.StartDate < request.CheckOutDate && x.EndDate >= request.CheckInDate).ToListAsync();
        decimal priceForStay = 0;
        for (var date = request.CheckInDate; date < request.CheckOutDate; date = date.AddDays(1))
            priceForStay += specialPrices.Where(x => x.StartDate <= date && x.EndDate >= date).Select(x => (decimal?)x.PricePerNight).FirstOrDefault() ?? roomType.BasePrice;
        var roomTotal = priceForStay * request.Quantity;
        var subtotal = roomTotal + extraFee;
        var now = DateTime.UtcNow;
        var bookingCode = $"TRP{now:yyMMddHHmmss}{Guid.NewGuid():N}"[..24].ToUpperInvariant();
        var transactionCode = $"{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant();
        var booking = new Booking { BookingCode = bookingCode, CustomerId = userId, HomestayId = roomType.HomestayId, CheckInDate = request.CheckInDate, CheckOutDate = request.CheckOutDate, AdultCount = request.AdultCount, ChildCount = request.ChildCount, Subtotal = subtotal, DiscountAmount = 0, ServiceFee = 0, TaxAmount = 0, TotalAmount = subtotal, Status = "PendingPayment", CustomerNote = request.CustomerNote, CreatedAt = now, UpdatedAt = now };
        var perRoomExtraFee = extraFee / request.Quantity;
        var perRoomLineTotal = subtotal / request.Quantity;
        foreach (var room in allocatableRooms)
            booking.Details.Add(new BookingDetail { RoomTypeId = roomType.Id, RoomId = room.Id, Quantity = 1, PricePerNight = priceForStay / nights, NumberOfNights = nights, ExtraFee = perRoomExtraFee, LineTotal = perRoomLineTotal });
        booking.Payments.Add(new Payment { TransactionCode = transactionCode, PaymentMethod = "VNPay", TransactionType = "Payment", Amount = subtotal, Status = "Pending", CreatedAt = now, UpdatedAt = now });
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "127.0.0.1";
        var paymentUrl = vnPay.CreatePaymentUrl(transactionCode, subtotal, $"Thanh toan dat phong {bookingCode}", ip);
        return Ok(new { bookingCode, amount = subtotal, paymentUrl, priceBreakdown = new { roomTotal, extraAdultCount, childCount = request.ChildCount, extraAdultFee = extraAdultCount * ExtraAdultFeePerNight * nights, childFee = request.ChildCount * ChildFeePerNight * nights, extraFee } });
    }

    [Authorize(Roles = "Customer,Host")]
    [HttpPost("{bookingId:long}/retry-payment")]
    public async Task<IActionResult> RetryPayment(long bookingId)
    {
        if (!vnPay.IsConfigured) return StatusCode(503, new { message = "VNPay chưa được cấu hình." });
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var booking = await db.Bookings.Include(x => x.Details)
            .SingleOrDefaultAsync(x => x.Id == bookingId && x.CustomerId == userId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy booking." });
        if (booking.Status is not ("PaymentFailed" or "Expired")) return BadRequest(new { message = "Booking này không thể thanh toán lại." });
        if (booking.CheckInDate < DateOnly.FromDateTime(DateTime.UtcNow)) return BadRequest(new { message = "Ngày nhận phòng đã qua." });
        var roomTypeId = booking.Details.Select(x => x.RoomTypeId).FirstOrDefault();
        var quantity = booking.Details.Sum(x => x.Quantity);
        if (roomTypeId == 0 || quantity < 1) return BadRequest(new { message = "Booking không có thông tin phòng hợp lệ." });

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock({0})", roomTypeId);
        var roomType = await db.RoomTypes.Include(x => x.Rooms)
            .SingleOrDefaultAsync(x => x.Id == roomTypeId && x.Status == "Active" && x.Homestay.Status == "Approved");
        if (roomType is null) return BadRequest(new { message = "Loại phòng không còn được kinh doanh." });
        var blocking = new[] { "PendingPayment", "Confirmed", "CheckedIn" };
        var usedRoomIds = await db.BookingDetails.AsNoTracking().Where(x => x.BookingId != booking.Id && x.RoomTypeId == roomTypeId && x.RoomId != null
                && x.Booking.CheckInDate < booking.CheckOutDate && x.Booking.CheckOutDate > booking.CheckInDate && blocking.Contains(x.Booking.Status))
            .Select(x => x.RoomId!.Value).ToListAsync();
        var rooms = roomType.Rooms.Where(x => x.Status == "Available" && !usedRoomIds.Contains(x.Id)).OrderBy(x => x.RoomNumber).Take(quantity).ToList();
        if (rooms.Count < quantity) return Conflict(new { message = "Phòng đã được khách khác đặt trong lúc giao dịch trước thất bại." });
        var details = booking.Details.ToList();
        if (details.Count != quantity)
        {
            var template = details[0];
            db.BookingDetails.RemoveRange(details);
            details = rooms.Select(room => new BookingDetail
            {
                BookingId = booking.Id, RoomTypeId = roomTypeId, RoomId = room.Id, Quantity = 1,
                PricePerNight = template.PricePerNight, NumberOfNights = template.NumberOfNights,
                ExtraFee = template.ExtraFee / quantity, LineTotal = template.LineTotal / quantity,
                GuestName = template.GuestName, Note = template.Note
            }).ToList();
            db.BookingDetails.AddRange(details);
        }
        else
            for (var index = 0; index < details.Count; index++) details[index].RoomId = rooms[index].Id;

        var now = DateTime.UtcNow;
        var transactionCode = $"{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..30].ToUpperInvariant();
        db.Payments.Add(new Payment { BookingId = booking.Id, TransactionCode = transactionCode, PaymentMethod = "VNPay", TransactionType = "Payment", Amount = booking.TotalAmount, Status = "Pending", CreatedAt = now, UpdatedAt = now });
        booking.Status = "PendingPayment";
        booking.CreatedAt = now;
        booking.UpdatedAt = now;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "127.0.0.1";
        return Ok(new { booking.BookingCode, amount = booking.TotalAmount, paymentUrl = vnPay.CreatePaymentUrl(transactionCode, booking.TotalAmount, $"Thanh toan lai dat phong {booking.BookingCode}", ip) });
    }

    [AllowAnonymous]
    [HttpGet("vnpay-return")]
    public async Task<IActionResult> VnPayReturn()
    {
        var clientUrl = Environment.GetEnvironmentVariable("CLIENT_URL") ?? "http://localhost:5173";
        if (!vnPay.Validate(Request.Query)) return Redirect($"{clientUrl}/?payment=invalid");
        var transactionCode = Request.Query["vnp_TxnRef"].ToString();
        var payment = await db.Payments.Include(x => x.Booking).SingleOrDefaultAsync(x => x.TransactionCode == transactionCode);
        if (payment is null) return Redirect($"{clientUrl}/?payment=notfound");
        var amountValid = long.TryParse(Request.Query["vnp_Amount"], out var paidAmount) && paidAmount == decimal.ToInt64(payment.Amount * 100);
        var success = amountValid && Request.Query["vnp_ResponseCode"] == "00" && Request.Query["vnp_TransactionStatus"] == "00";
        if (payment.Status == "Pending")
        {
            payment.Status = success ? "Success" : "Failed"; payment.PaidAt = success ? DateTime.UtcNow : null; payment.UpdatedAt = DateTime.UtcNow;
            payment.GatewayResponse = JsonSerializer.Serialize(Request.Query.ToDictionary(x => x.Key, x => x.Value.ToString()));
            payment.Booking.Status = success ? "Confirmed" : "PaymentFailed"; payment.Booking.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        var confirmed = payment.Status == "Success" && payment.Booking.Status == "Confirmed";
        return Redirect($"{clientUrl}/?payment={(confirmed ? "success" : "failed")}&bookingCode={Uri.EscapeDataString(payment.Booking.BookingCode)}");
    }

    [AllowAnonymous]
    [HttpGet("vnpay-ipn")]
    public async Task<IActionResult> VnPayIpn()
    {
        if (!vnPay.Validate(Request.Query)) return Ok(new { RspCode = "97", Message = "Invalid signature" });
        var transactionCode = Request.Query["vnp_TxnRef"].ToString();
        var payment = await db.Payments.Include(x => x.Booking).SingleOrDefaultAsync(x => x.TransactionCode == transactionCode);
        if (payment is null) return Ok(new { RspCode = "01", Message = "Order not found" });
        if (!long.TryParse(Request.Query["vnp_Amount"], out var amount) || amount != decimal.ToInt64(payment.Amount * 100))
            return Ok(new { RspCode = "04", Message = "Invalid amount" });
        if (payment.Status != "Pending") return Ok(new { RspCode = "02", Message = "Order already processed" });
        if (payment.Booking.Status != "PendingPayment") return Ok(new { RspCode = "02", Message = "Booking is no longer payable" });
        var success = Request.Query["vnp_ResponseCode"] == "00" && Request.Query["vnp_TransactionStatus"] == "00";
        payment.Status = success ? "Success" : "Failed";
        payment.PaidAt = success ? DateTime.UtcNow : null;
        payment.UpdatedAt = DateTime.UtcNow;
        payment.GatewayResponse = JsonSerializer.Serialize(Request.Query.ToDictionary(x => x.Key, x => x.Value.ToString()));
        payment.Booking.Status = success ? "Confirmed" : "PaymentFailed";
        payment.Booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { RspCode = "00", Message = "Confirm Success" });
    }
}
