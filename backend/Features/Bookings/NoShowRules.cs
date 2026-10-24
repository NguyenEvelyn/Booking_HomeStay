using HomestayAuth.Api.Domain.Entities;

namespace HomestayAuth.Api.Features.Bookings;

// Pure no-show rules (no database), shared by the API, the reminder worker and the checks project.
public static class NoShowRules
{
    public const int DisputeWindowHours = 48;
    // A guest who announced a late arrival keeps the room until this long after the announced time.
    public const int LateArrivalBufferHours = 1;

    public static TimeZoneInfo Zone(string? timeZoneId)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(string.IsNullOrWhiteSpace(timeZoneId) ? "Asia/Ho_Chi_Minh" : timeZoneId); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows() ? "SE Asia Standard Time" : "Asia/Ho_Chi_Minh"); }
    }

    public static DateTime LocalToUtc(DateOnly date, TimeOnly time, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Unspecified), zone);

    /// <summary>Earliest moment the host may release the room: check-in time + grace, or later if the guest announced a late arrival.</summary>
    public static DateTime DeadlineUtc(DateOnly checkInDate, TimeOnly checkInTime, TimeZoneInfo zone, NoShowPolicy policy, DateTime? expectedArrivalUtc)
    {
        var standard = LocalToUtc(checkInDate, checkInTime, zone).AddHours(Math.Clamp(policy.GraceHours, 1, 24));
        if (expectedArrivalUtc is null) return standard;
        var announced = expectedArrivalUtc.Value.AddHours(LateArrivalBufferHours);
        return announced > standard ? announced : standard;
    }

    /// <summary>A late arrival can be announced from the check-in day until 06:00 the next morning (local time).</summary>
    public static string? ValidateExpectedArrival(DateOnly checkInDate, TimeOnly checkInTime, TimeZoneInfo zone, DateTime expectedArrivalUtc, DateTime nowUtc)
    {
        var earliest = LocalToUtc(checkInDate, checkInTime, zone);
        var latest = LocalToUtc(checkInDate.AddDays(1), new TimeOnly(6, 0), zone);
        if (expectedArrivalUtc < earliest) return "Giờ đến dự kiến phải từ giờ nhận phòng trở đi.";
        if (expectedArrivalUtc > latest) return "Chỉ báo đến muộn tối đa đến 06:00 sáng hôm sau ngày nhận phòng. Nếu đến muộn hơn, vui lòng liên hệ chủ nhà để đổi ngày.";
        if (expectedArrivalUtc < nowUtc) return "Giờ đến dự kiến đã qua.";
        return null;
    }

    /// <summary>Money outcome: the host keeps the penalty (capped at what was paid); the rest is refunded at RemainingRefundPercent.</summary>
    public static (decimal Retained, decimal Refund) Settlement(decimal paidAmount, decimal depositAmount, decimal totalAmount, int nights, NoShowPolicy policy)
    {
        var paid = Math.Max(0, paidAmount);
        var firstNight = decimal.Round(totalAmount / Math.Max(1, nights), 0, MidpointRounding.AwayFromZero);
        var penaltyBase = policy.Penalty == NoShowPenalty.FirstNight ? firstNight : depositAmount;
        var penalty = Math.Min(paid, Math.Max(0, penaltyBase));
        var refund = decimal.Round((paid - penalty) * Math.Clamp(policy.RemainingRefundPercent, 0, 100) / 100m, 0, MidpointRounding.AwayFromZero);
        return (paid - refund, refund);
    }

    public static string PenaltyLabel(NoShowPolicy policy) => policy.Penalty == NoShowPenalty.FirstNight
        ? $"Giữ lại tiền 1 đêm, hoàn {policy.RemainingRefundPercent:0.##}% phần đã trả còn lại"
        : $"Giữ lại tiền cọc, hoàn {policy.RemainingRefundPercent:0.##}% phần đã trả còn lại";

    public static string? ValidatePolicy(NoShowPolicy policy) =>
        policy.GraceHours is < 1 or > 24 ? "Thời gian ân hạn no-show phải từ 1 đến 24 giờ."
        : policy.Penalty is not (NoShowPenalty.Deposit or NoShowPenalty.FirstNight) ? "Mức phạt no-show không hợp lệ."
        : policy.RemainingRefundPercent is < 0 or > 100 ? "Tỷ lệ hoàn khi no-show phải nằm trong khoảng 0–100%."
        : null;
}
