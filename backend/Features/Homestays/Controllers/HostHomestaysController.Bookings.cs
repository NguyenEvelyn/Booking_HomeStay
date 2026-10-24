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

// Host booking list, booking metadata (viewed/note/timing/offline payment/status), cancellation decisions and listing submission.
public sealed partial class HostHomestaysController
{
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
                    : (b.Status == "Cancelled" || b.Status == "NoShow" || b.Status == BookingStatus.Expired) ? 4 : 3)
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
}
