using System.Security.Claims;
using System.Text.Json;
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

    [Authorize(Roles = "Customer")]
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine()
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var items = await db.Bookings.AsNoTracking().Where(x => x.CustomerId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.BookingCode, x.HomestayId, HomestayName = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.Name).First(), x.CheckInDate, x.CheckOutDate, x.AdultCount, x.ChildCount, x.TotalAmount, x.Status, x.CreatedAt, CanReview = x.CheckOutDate <= DateOnly.FromDateTime(DateTime.UtcNow) && !db.Reviews.Any(r => r.BookingId == x.Id) })
            .ToListAsync();
        return Ok(new { items });
    }

    [Authorize(Roles = "Customer")]
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

    [Authorize(Roles = "Customer")]
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

    [Authorize(Roles = "Customer")]
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
        db.Cancellations.Add(new Cancellation { BookingId = booking.Id, CancelledBy = userId, Reason = reason, CancelledAt = DateTime.UtcNow, CancellationFee = fee, RefundAmount = paid - fee, Status = "Requested" });
        booking.Status = "Cancelled"; booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã gửi yêu cầu hủy phòng.", cancellationFee = fee, refundAmount = paid - fee });
    }

    [Authorize(Roles = "Customer")]
    [HttpPost("vnpay")]
    public async Task<IActionResult> CreateVnPayPayment(CreateBookingRequest request)
    {
        if (!vnPay.IsConfigured) return StatusCode(503, new { message = "VNPay chưa được cấu hình. Vui lòng thêm VNPAY_TMN_CODE và VNPAY_HASH_SECRET." });
        if (request.CheckInDate < DateOnly.FromDateTime(DateTime.Today) || request.CheckOutDate <= request.CheckInDate)
            return BadRequest(new { message = "Ngày nhận hoặc trả phòng không hợp lệ." });
        if (request.AdultCount < 1 || request.ChildCount < 0 || request.Quantity < 1 || request.Quantity > 10) return BadRequest(new { message = "Số khách hoặc số phòng không hợp lệ." });

        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var roomType = await db.RoomTypes.Include(x => x.Rooms).SingleOrDefaultAsync(x => x.Id == request.RoomTypeId && x.Status == "Active");
        if (roomType is null) return NotFound(new { message = "Không tìm thấy loại phòng." });
        if (request.AdultCount > roomType.MaxAdults * request.Quantity || request.ChildCount > roomType.MaxChildren * request.Quantity)
            return BadRequest(new { message = "Số khách vượt quá sức chứa của phòng." });
        var physicalRoomCount = roomType.Rooms.Count(x => x.Status == "Available");
        var holdCutoff = DateTime.UtcNow.AddMinutes(-15);
        var reservedRoomCount = await db.BookingDetails.Where(detail =>
            detail.RoomTypeId == request.RoomTypeId &&
            detail.Booking.CheckInDate < request.CheckOutDate && detail.Booking.CheckOutDate > request.CheckInDate &&
            (detail.Booking.Status == "Confirmed" ||
             (detail.Booking.Status == "PendingPayment" && detail.Booking.CreatedAt >= holdCutoff))).SumAsync(detail => (int?)detail.Quantity) ?? 0;
        if (physicalRoomCount - reservedRoomCount < request.Quantity)
            return Conflict(new { message = "Loại phòng này đã hết phòng trong khoảng ngày bạn chọn." });

        var nights = request.CheckOutDate.DayNumber - request.CheckInDate.DayNumber;
        var includedAdults = Math.Min(2, roomType.MaxAdults) * request.Quantity;
        var extraAdultCount = Math.Max(0, request.AdultCount - includedAdults);
        var extraFee = (extraAdultCount * ExtraAdultFeePerNight + request.ChildCount * ChildFeePerNight) * nights;
        var roomTotal = roomType.BasePrice * nights * request.Quantity;
        var subtotal = roomTotal + extraFee;
        var now = DateTime.UtcNow;
        var bookingCode = $"TRP{now:yyMMddHHmmss}{Random.Shared.Next(100, 999)}";
        var transactionCode = $"{now:yyyyMMddHHmmss}{Random.Shared.Next(1000, 9999)}";
        var booking = new Booking { BookingCode = bookingCode, CustomerId = userId, HomestayId = roomType.HomestayId, CheckInDate = request.CheckInDate, CheckOutDate = request.CheckOutDate, AdultCount = request.AdultCount, ChildCount = request.ChildCount, Subtotal = subtotal, DiscountAmount = 0, ServiceFee = 0, TaxAmount = 0, TotalAmount = subtotal, Status = "PendingPayment", CustomerNote = request.CustomerNote, CreatedAt = now, UpdatedAt = now };
        booking.Details.Add(new BookingDetail { RoomTypeId = roomType.Id, Quantity = request.Quantity, PricePerNight = roomType.BasePrice, NumberOfNights = nights, ExtraFee = extraFee, LineTotal = subtotal });
        booking.Payments.Add(new Payment { TransactionCode = transactionCode, PaymentMethod = "VNPay", TransactionType = "Payment", Amount = subtotal, Status = "Pending", CreatedAt = now, UpdatedAt = now });
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "127.0.0.1";
        var paymentUrl = vnPay.CreatePaymentUrl(transactionCode, subtotal, $"Thanh toan dat phong {bookingCode}", ip);
        return Ok(new { bookingCode, amount = subtotal, paymentUrl, priceBreakdown = new { roomTotal, extraAdultCount, childCount = request.ChildCount, extraAdultFee = extraAdultCount * ExtraAdultFeePerNight * nights, childFee = request.ChildCount * ChildFeePerNight * nights, extraFee } });
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
            payment.Booking.Status = success ? "Confirmed" : "PendingPayment"; payment.Booking.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        return Redirect($"{clientUrl}/?payment={(success ? "success" : "failed")}&bookingCode={Uri.EscapeDataString(payment.Booking.BookingCode)}");
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
        if (payment.Status != "Pending") return Ok(new { RspCode = "02", Message = "Order already confirmed" });
        var success = Request.Query["vnp_ResponseCode"] == "00" && Request.Query["vnp_TransactionStatus"] == "00";
        payment.Status = success ? "Success" : "Failed";
        payment.PaidAt = success ? DateTime.UtcNow : null;
        payment.UpdatedAt = DateTime.UtcNow;
        payment.GatewayResponse = JsonSerializer.Serialize(Request.Query.ToDictionary(x => x.Key, x => x.Value.ToString()));
        payment.Booking.Status = success ? "Confirmed" : "PendingPayment";
        payment.Booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { RspCode = "00", Message = "Confirm Success" });
    }
}
