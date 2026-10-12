using System.Security.Claims;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Admin.Audit;
using HomestayAuth.Api.Features.Admin.Authorization;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Admin.Controllers;

public sealed record BookingSettings(int HoldMinutes, int CancellationHours, int AdvanceBookingDays, string DefaultCheckIn, string DefaultCheckOut, bool InstantBooking);
public sealed record PaymentSettings(decimal CommissionPercent, decimal DepositPercent, decimal ReconciliationThreshold, int RefundDeadlineDays, string VnPayEnvironment);
public sealed record AiSettings(bool RecommendationEnabled, bool DemandForecastEnabled, int MinimumHistoryMonths, int MinimumBookings, bool SyntheticDataEnabled);
public sealed record SystemSettingsDocument(BookingSettings Booking, PaymentSettings Payment, AiSettings Ai);

[ApiController, Route("api/admin/settings"), Authorize(Policy = AdminPolicies.Access)]
public sealed class AdminSettingsController(AppDbContext db, IAuditLogService audit) : ControllerBase
{
    private const string SettingKey = "platform";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly SystemSettingsDocument Defaults = new(
        new(15, 24, 365, "14:00", "12:00", false),
        new(10, 30, 1000, 7, "Sandbox"),
        new(true, true, 6, 20, true));

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var row = await db.SystemSettings.AsNoTracking().SingleOrDefaultAsync(x => x.Key == SettingKey, cancellationToken);
        var document = Parse(row?.ValueJson);
        string? updatedByName = null;
        if (row?.UpdatedBy is long updater)
            updatedByName = await db.Users.AsNoTracking().Where(x => x.Id == updater).Select(x => x.FullName).SingleOrDefaultAsync(cancellationToken);
        return Ok(new { settings = document, updatedAt = row?.UpdatedAt, updatedBy = updatedByName, defaults = Defaults });
    }

    [HttpPut, Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> Put(SystemSettingsDocument request, CancellationToken cancellationToken)
    {
        var validation = Validate(request);
        if (validation is not null) return BadRequest(new { message = validation });
        var row = await db.SystemSettings.SingleOrDefaultAsync(x => x.Key == SettingKey, cancellationToken);
        var before = row is null ? Defaults : Parse(row.ValueJson);
        var actorId = long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : (long?)null;
        if (row is null)
        {
            row = new SystemSetting { Key = SettingKey };
            db.SystemSettings.Add(row);
        }
        row.ValueJson = JsonSerializer.Serialize(request, JsonOptions);
        row.UpdatedBy = actorId;
        row.UpdatedAt = DateTime.UtcNow;
        audit.Add(HttpContext, "settings.update", "system_settings", SettingKey, before, request, "Cập nhật cấu hình hệ thống");
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "Đã lưu cấu hình hệ thống.", settings = request, updatedAt = row.UpdatedAt });
    }

    private static SystemSettingsDocument Parse(string? json)
    {
        try { return string.IsNullOrWhiteSpace(json) ? Defaults : JsonSerializer.Deserialize<SystemSettingsDocument>(json, JsonOptions) ?? Defaults; }
        catch (JsonException) { return Defaults; }
    }

    private static string? Validate(SystemSettingsDocument x)
    {
        if (x.Booking.HoldMinutes is < 5 or > 120) return "Thời gian giữ phòng phải từ 5 đến 120 phút.";
        if (x.Booking.CancellationHours is < 0 or > 720) return "Thời hạn hủy phải từ 0 đến 720 giờ.";
        if (x.Booking.AdvanceBookingDays is < 1 or > 730) return "Thời gian đặt trước phải từ 1 đến 730 ngày.";
        if (!TimeOnly.TryParse(x.Booking.DefaultCheckIn, out _) || !TimeOnly.TryParse(x.Booking.DefaultCheckOut, out _)) return "Giờ check-in/check-out không hợp lệ.";
        if (x.Payment.CommissionPercent is < 0 or > 50 || x.Payment.DepositPercent is < 0 or > 100) return "Tỷ lệ hoa hồng hoặc tiền cọc không hợp lệ.";
        if (x.Payment.ReconciliationThreshold < 0 || x.Payment.RefundDeadlineDays is < 1 or > 30) return "Ngưỡng đối soát hoặc hạn hoàn tiền không hợp lệ.";
        if (x.Payment.VnPayEnvironment is not ("Sandbox" or "Production")) return "Môi trường VNPay không hợp lệ.";
        if (x.Ai.MinimumHistoryMonths is < 1 or > 60 || x.Ai.MinimumBookings is < 5 or > 10000) return "Ngưỡng dữ liệu AI không hợp lệ.";
        return null;
    }
}
