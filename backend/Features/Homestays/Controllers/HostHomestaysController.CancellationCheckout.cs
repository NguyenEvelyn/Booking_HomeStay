using HomestayAuth.Api.Features.Notifications;
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

// Host-initiated cancellation (with refund preview) and check-out settlement.
public sealed partial class HostHomestaysController
{
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

        // The host cancels, so the guest is refunded in full by default; the host may lower it
        // (e.g. a guest-requested cancellation) within [0, paid] when confirming.
        const decimal refundPercent = 100;
        const string policyDesc = "Chủ nhà hủy đơn: hoàn 100% số tiền khách đã thanh toán (có thể điều chỉnh trong khoảng 0 – số đã trả).";

        var paidAmount = booking.Payments
            .Where(p => p.TransactionType != "Refund" && p.Status == "Success")
            .Sum(p => (decimal?)p.Amount) ?? 0;

        var refundAmount = paidAmount;
        var cancellationFee = 0m;

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

        var paidAmount = booking.Payments
            .Where(p => p.TransactionType != "Refund" && p.Status == "Success")
            .Sum(p => (decimal?)p.Amount) ?? 0;

        // The fee is always what is kept from the paid amount, so refund and fee can never disagree.
        var (finalRefundAmount, finalCancellationFee, refundPercent, refundError) = BookingRules.HostCancellation(paidAmount, request.OverrideRefundAmount);
        if (refundError is not null) return BadRequest(new { message = refundError });

        // Refunds already queued (e.g. from an earlier guest cancellation request) count toward the total.
        var alreadyRefundedOrQueued = booking.Payments
            .Where(p => p.TransactionType == "Refund" && p.Status != "Failed")
            .Sum(p => (decimal?)p.Amount) ?? 0;
        if (finalRefundAmount < alreadyRefundedOrQueued)
            return Conflict(new { message = $"Đã có khoản hoàn {alreadyRefundedOrQueued:N0}đ được tạo, không thể hoàn ít hơn số này." });

        var now = DateTime.UtcNow;
        var oldStatus = booking.Status;
        booking.Status = BookingStatus.Cancelled;
        booking.UpdatedAt = now;

        // Release every room of the booking, as the guest cancellation flow does.
        var roomIds = booking.Details.Where(d => d.RoomId.HasValue).Select(d => d.RoomId!.Value).Distinct().ToList();
        await db.Rooms.Where(r => roomIds.Contains(r.Id) && (r.Status == "Occupied" || r.Status == "Hold"))
            .ExecuteUpdateAsync(r => r.SetProperty(x => x.Status, "Available").SetProperty(x => x.UpdatedAt, now));
        await db.BookingRoomStays.Where(x => x.BookingId == bookingId && x.Status == "Active").ExecuteUpdateAsync(x => x.SetProperty(s => s.Status, "Cancelled"));
        await db.AdditionalCharges.Where(x => x.BookingId == bookingId && !x.IsPaid).ExecuteUpdateAsync(x => x.SetProperty(c => c.Status, ChargeStatus.Waived).SetProperty(c => c.TotalPrice, 0));

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
                Status = "Approved",
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
            cancellation.Status = "Approved";
            cancellation.ProcessedBy = HostId;
            cancellation.ProcessedAt = now;
        }

        // The refund stays Pending until the money is actually returned (host confirms via
        // POST /api/refunds/{id}/confirm), instead of being recorded as already paid.
        var refundToQueue = finalRefundAmount - alreadyRefundedOrQueued;
        paymentService.QueueRefund(bookingId, refundToQueue,
            $"Host hủy đơn đặt phòng ({daysBeforeCheckIn} ngày trước check-in). Hoàn tiền {finalRefundAmount:N0}đ (Phí hủy: {finalCancellationFee:N0}đ)");
        if (finalRefundAmount > 0) booking.PaymentStatus = PaymentStatus.RefundPending;
        notifications.Notify(booking.CustomerId, NotificationTemplates.CancelledByHost(booking.Id, booking.BookingCode,
            await db.Homestays.Where(h => h.Id == booking.HomestayId).Select(h => h.Name).SingleAsync(), finalRefundAmount));

        await LogAudit("CancelBooking", bookingId,
            beforeJson: $"{{\"status\": \"{oldStatus}\", \"paidAmount\": {paidAmount}}}",
            afterJson: $"{{\"status\": \"Cancelled\", \"refundAmount\": {finalRefundAmount}, \"cancellationFee\": {finalCancellationFee}, \"daysBeforeCheckIn\": {daysBeforeCheckIn}}}",
            reason: request.Reason?.Trim() ?? "Host thực hiện hủy đơn đặt phòng");

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new
        {
            message = $"Đã hủy đơn đặt phòng thành công.{(finalRefundAmount > 0 ? $" Khoản hoàn tiền {finalRefundAmount:N0}đ đã được tạo và đang chờ chủ nhà xác nhận đã chuyển." : "")}",
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
