using System.Text;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Admin.Audit;
using HomestayAuth.Api.Features.Bookings;
using HomestayAuth.Api.Features.Admin.Authorization;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Admin.Controllers;

[ApiController, Route("api/admin/payments"), Authorize(Policy = AdminPolicies.Access)]
public sealed record PaymentSyncRequest(string Reason);
public sealed class AdminPaymentsController(AppDbContext db, VnPayService vnPay, IAuditLogService audit) : ControllerBase
{
    [HttpPost("{id:long}/sync"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> Sync(long id, PaymentSyncRequest request, CancellationToken cancellationToken)
    {
        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 500) return BadRequest(new { message = "Vui lòng nhập lý do đối soát, tối đa 500 ký tự." });
        var original = await db.Payments.AsNoTracking().Where(p => p.Id == id && p.TransactionType == "Payment" && p.PaymentMethod == "VNPay")
            .Select(p => new { p.BookingId, p.TransactionCode, p.Amount, p.CreatedAt }).SingleOrDefaultAsync(cancellationToken);
        if (original is null) return NotFound(new { message = "Không tìm thấy giao dịch VNPAY." });
        VnPayQueryResult result;
        try
        {
            result = await vnPay.QueryTransaction(original.TransactionCode, original.CreatedAt,
                HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "127.0.0.1", cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException)
        {
            return StatusCode(502, new { message = "Không thể xác minh giao dịch từ VNPAY. Không có dữ liệu nào được cập nhật." });
        }
        if (result.ResponseCode != "00") return Conflict(new { message = $"VNPAY chưa trả về kết quả giao dịch (mã {result.ResponseCode})." });
        if (result.TransactionType != "01") return Conflict(new { message = "VNPAY không trả về giao dịch thu tiền ban đầu; cần kiểm tra thủ công." });
        if (result.TransactionStatus is not ("00" or "02"))
            return Conflict(new { message = $"Giao dịch VNPAY ở trạng thái {result.TransactionStatus}; chưa thể tự cập nhật, cần kiểm tra thủ công." });
        if (result.Amount != decimal.ToInt64(original.Amount * 100))
            return Conflict(new { message = "Số tiền đối soát khác số tiền đã gửi VNPAY; cần kiểm tra thủ công." });
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await BookingAvailability.LockBooking(db, original.BookingId);
        var payment = await db.Payments.Include(p => p.Booking).SingleAsync(p => p.Id == id, cancellationToken);
        if (payment.Amount != payment.Booking.TotalAmount)
            return Conflict(new { message = "Số tiền giao dịch không khớp đơn; cần kiểm tra thủ công trước khi đổi trạng thái." });
        var now = DateTime.UtcNow;
        var success = result.TransactionStatus == "00";
        if (payment.Status == "Success" && !success)
            return Conflict(new { message = "VNPAY và dữ liệu đã ghi nhận không khớp; cần kiểm tra thủ công, không tự hạ trạng thái giao dịch." });
        var before = new { payment.Status, BookingStatus = payment.Booking.Status };
        payment.Status = success ? "Success" : "Failed";
        payment.ResponseCode = result.TransactionStatus;
        payment.VnPayTransactionNo = result.TransactionNo;
        payment.BankCode = result.BankCode;
        payment.UpdatedAt = now;
        payment.PaidAt = success ? payment.PaidAt ?? now : null;
        if (success && BookingRules.CanConfirm(payment.Booking.Status, payment.Booking.UpdatedAt, payment.CreatedAt, now))
        {
            payment.Booking.Status = "Confirmed";
            payment.Booking.UpdatedAt = now;
        }
        else if (!success && payment.Booking.Status == "PendingPayment")
        {
            payment.Booking.Status = "PaymentFailed";
            payment.Booking.UpdatedAt = now;
        }
        else if (success && payment.Booking.Status == "PendingPayment" && !BookingRules.IsActiveHold(payment.Booking.Status, payment.Booking.UpdatedAt, now))
        {
            payment.Booking.Status = "Expired";
            payment.Booking.UpdatedAt = now;
        }
        if (success && payment.Booking.Status is ("Cancelled" or "Expired" or "PaymentFailed" or "CancellationRequested")
            && !await db.Payments.AnyAsync(p => p.TransactionCode == "RF" + payment.TransactionCode, cancellationToken))
        {
            db.Payments.Add(new Payment { BookingId = original.BookingId, TransactionCode = "RF" + payment.TransactionCode,
                PaymentMethod = "VNPay", TransactionType = "Refund", Amount = payment.Amount, Status = "Pending",
                GatewayResponse = "Payment confirmed by QueryDr after room hold ended; manual refund required",
                CreatedAt = now, UpdatedAt = now });
        }
        audit.Add(HttpContext, "payment.sync", "payment", id, before,
            new { payment.Status, BookingStatus = payment.Booking.Status, result.TransactionNo, result.TransactionStatus }, reason);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(new { message = success ? "Đã đối soát giao dịch thành công với VNPAY." : "VNPAY xác nhận giao dịch không thành công." });
    }
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, [FromQuery] string? status = null, [FromQuery] string? method = null,
        [FromQuery] string? responseCode = null, [FromQuery] string? bank = null, [FromQuery] bool discrepancy = false,
        [FromQuery] DateOnly? from = null, [FromQuery] DateOnly? to = null, [FromQuery] string sort = "createdAt_desc")
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 100);
        var query = db.Payments.AsNoTracking().Where(p => p.TransactionType == "Payment");
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(p => EF.Functions.ILike(p.TransactionCode, term) ||
                (p.VnPayTransactionNo != null && EF.Functions.ILike(p.VnPayTransactionNo, term)) ||
                EF.Functions.ILike(p.Booking.BookingCode, term));
        }
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(p => p.Status == status);
        if (!string.IsNullOrWhiteSpace(method)) query = query.Where(p => p.PaymentMethod == method);
        if (!string.IsNullOrWhiteSpace(responseCode)) query = query.Where(p => p.ResponseCode == responseCode);
        if (!string.IsNullOrWhiteSpace(bank)) query = query.Where(p => p.BankCode == bank);
        if (from.HasValue) { var startUtc = VietNamStart(from.Value); query = query.Where(p => p.CreatedAt >= startUtc); }
        if (to.HasValue) { var endUtc = VietNamStart(to.Value.AddDays(1)); query = query.Where(p => p.CreatedAt < endUtc); }
        if (discrepancy) query = query.Where(p => p.Status == "Success" &&
            (p.Amount != p.Booking.TotalAmount || p.Booking.Status == "PendingPayment" ||
             p.Booking.Status == "Cancelled" || p.Booking.Status == "Expired" || p.Booking.Status == "PaymentFailed"));
        query = sort switch { "createdAt_asc" => query.OrderBy(p => p.CreatedAt),
            "amount_desc" => query.OrderByDescending(p => p.Amount), "amount_asc" => query.OrderBy(p => p.Amount),
            _ => query.OrderByDescending(p => p.CreatedAt) };
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(p => new
        {
            p.Id, p.BookingId, p.Booking.BookingCode, bookingStatus = p.Booking.Status, p.TransactionCode,
            p.VnPayTransactionNo, p.Amount, bookingAmount = p.Booking.TotalAmount, p.PaymentMethod,
            p.ResponseCode, p.BankCode, p.Status, p.CreatedAt, p.PaidAt,
            discrepancy = p.Status == "Success" && (p.Amount != p.Booking.TotalAmount ||
                p.Booking.Status == "PendingPayment" || p.Booking.Status == "Cancelled" ||
                p.Booking.Status == "Expired" || p.Booking.Status == "PaymentFailed")
        }).ToListAsync();
        return Ok(new { items, page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [HttpGet("refunds")]
    public async Task<IActionResult> Refunds([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, [FromQuery] string? status = null, [FromQuery] string sort = "createdAt_desc")
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 100);
        var query = db.Payments.AsNoTracking().Where(p => p.TransactionType == "Refund");
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(p => EF.Functions.ILike(p.Booking.BookingCode, $"%{search.Trim()}%"));
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(p => p.Status == status);
        query = sort == "createdAt_asc" ? query.OrderBy(p => p.CreatedAt) : query.OrderByDescending(p => p.CreatedAt);
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(p => new
        {
            p.Id, p.BookingId, p.Booking.BookingCode, p.TransactionCode, p.Amount, p.Status,
            p.CreatedAt, p.PaidAt, p.PaymentMethod,
            reason = db.Cancellations.Where(c => c.BookingId == p.BookingId).Select(c => c.Reason).FirstOrDefault(),
            actorId = db.Cancellations.Where(c => c.BookingId == p.BookingId).Select(c => c.ProcessedBy).FirstOrDefault()
        }).ToListAsync();
        return Ok(new { items, page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [HttpGet("host-report")]
    public async Task<IActionResult> HostReport([FromQuery] int year, [FromQuery] int month,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? search = null,
        [FromQuery] string sort = "payout_desc")
    {
        if (year is < 2020 or > 2100 || month is < 1 or > 12) return BadRequest(new { message = "Kỳ báo cáo không hợp lệ." });
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 100);
        var start = VietNamStart(new DateOnly(year, month, 1));
        var end = VietNamStart(new DateOnly(year, month, 1).AddMonths(1));
        var rows = (from b in db.Bookings.AsNoTracking()
            join h in db.Homestays on b.HomestayId equals h.Id
            join u in db.Users on h.HostId equals u.Id
            where b.Status == "Completed" && b.UpdatedAt >= start && b.UpdatedAt < end
            select new { Booking = b, Host = u })
            .GroupBy(x => new { HostId = x.Host.Id, x.Host.FullName, x.Host.Email })
            .Select(g => new { hostId = g.Key.HostId, hostName = g.Key.FullName, email = g.Key.Email,
                bookings = g.Count(), gmv = g.Sum(x => x.Booking.TotalAmount),
                commission = g.Sum(x => x.Booking.TotalAmount * x.Booking.CommissionRate),
                payout = g.Sum(x => x.Booking.TotalAmount * (1 - x.Booking.CommissionRate)) });
        if (!string.IsNullOrWhiteSpace(search)) rows = rows.Where(x => EF.Functions.ILike(x.hostName, $"%{search.Trim()}%") || EF.Functions.ILike(x.email, $"%{search.Trim()}%"));
        rows = sort switch { "host_asc" => rows.OrderBy(x => x.hostName), "gmv_desc" => rows.OrderByDescending(x => x.gmv),
            _ => rows.OrderByDescending(x => x.payout) };
        var total = await rows.CountAsync();
        var items = await rows.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new { items, year, month, page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [HttpGet("export"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> Export([FromQuery] string type, [FromQuery] int year, [FromQuery] int month)
    {
        if (year is < 2020 or > 2100 || month is < 1 or > 12 || type is not ("transactions" or "hosts"))
            return BadRequest(new { message = "Yêu cầu xuất dữ liệu không hợp lệ." });
        var start = VietNamStart(new DateOnly(year, month, 1));
        var end = VietNamStart(new DateOnly(year, month, 1).AddMonths(1));
        var csv = new StringBuilder("\uFEFF");
        if (type == "transactions")
        {
            csv.AppendLine("Mã giao dịch,Mã đơn,Loại,Số tiền,Trạng thái,Phương thức,Mã phản hồi,Ngân hàng,Thời gian");
            await foreach (var p in db.Payments.AsNoTracking().Where(p => p.CreatedAt >= start && p.CreatedAt < end)
                .OrderBy(p => p.Id).Select(p => new { p.TransactionCode, p.Booking.BookingCode, p.TransactionType,
                    p.Amount, p.Status, p.PaymentMethod, p.ResponseCode, p.BankCode, p.CreatedAt }).AsAsyncEnumerable())
                csv.AppendLine(string.Join(',', new[] { p.TransactionCode, p.BookingCode, p.TransactionType,
                    p.Amount.ToString(System.Globalization.CultureInfo.InvariantCulture), p.Status, p.PaymentMethod,
                    p.ResponseCode ?? "", p.BankCode ?? "", p.CreatedAt.ToString("O") }.Select(Csv)));
        }
        else
        {
            csv.AppendLine("Host,Email,Số đơn,GMV,Hoa hồng,Phải trả");
            var rows = await (from b in db.Bookings.AsNoTracking()
                join h in db.Homestays on b.HomestayId equals h.Id
                join u in db.Users on h.HostId equals u.Id
                where b.Status == "Completed" && b.UpdatedAt >= start && b.UpdatedAt < end
                select new { Booking = b, Host = u })
                .GroupBy(x => new { x.Host.Id, x.Host.FullName, x.Host.Email })
                .Select(g => new { g.Key.FullName, g.Key.Email, Count = g.Count(), Gmv = g.Sum(x => x.Booking.TotalAmount),
                    Commission = g.Sum(x => x.Booking.TotalAmount * x.Booking.CommissionRate), Payout = g.Sum(x => x.Booking.TotalAmount * (1 - x.Booking.CommissionRate)) }).ToListAsync();
            foreach (var r in rows) csv.AppendLine(string.Join(',', new[] { r.FullName, r.Email, r.Count.ToString(),
                r.Gmv.ToString(System.Globalization.CultureInfo.InvariantCulture), r.Commission.ToString(System.Globalization.CultureInfo.InvariantCulture),
                r.Payout.ToString(System.Globalization.CultureInfo.InvariantCulture) }.Select(Csv)));
        }
        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv; charset=utf-8", $"tripio-{type}-{year}-{month:00}.csv");
    }

    private static string Csv(string value)
    {
        var safe = value.Length > 0 && "=+-@\t\r".Contains(value[0]) ? "'" + value : value;
        return $"\"{safe.Replace("\"", "\"\"")}\"";
    }
    private static DateTime VietNamStart(DateOnly day)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows() ? "SE Asia Standard Time" : "Asia/Ho_Chi_Minh");
        return TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue), zone);
    }
}
