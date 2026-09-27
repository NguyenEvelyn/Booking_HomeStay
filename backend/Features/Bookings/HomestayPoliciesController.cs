using System.Security.Claims;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

public sealed record CancellationTierRequest(int MinimumDays, int? MaximumDays, decimal RefundPercent);
public sealed record LateTierRequest(int FromMinutes, int? ToMinutes, string CalculationType, decimal Value);
public sealed record SavePolicyRequest(int HoldMinutes, int ReviewCreateDays, int ReviewEditDays, decimal CommissionRate,
    string GuestDowngradeRefundMode, decimal GuestDowngradeRefundPercent, bool AutoApproveLateCheckoutWithoutNextBooking,
    DateTime? EffectiveFrom, IReadOnlyList<CancellationTierRequest> CancellationTiers, IReadOnlyList<LateTierRequest> LateCheckoutTiers,
    OperationalPolicyDocument? Document = null);

[ApiController, Route("api/host/homestays/{homestayId:long}/booking-policy"), Authorize(Roles = "Host")]
public sealed class HomestayPoliciesController(AppDbContext db, PolicyService policies) : ControllerBase
{
    private long UserId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get(long homestayId)
    {
        if (!await Owns(homestayId)) return NotFound();
        return Ok(await policies.Resolve(homestayId, DateTime.UtcNow));
    }

    [HttpPut]
    public async Task<IActionResult> Put(long homestayId, SavePolicyRequest request)
    {
        if (!await Owns(homestayId)) return NotFound();
        var error = Validate(request); if (error is not null) return BadRequest(new { message = error });
        await using var tx = await db.Database.BeginTransactionAsync(); await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock({0})", -homestayId);
        var now = DateTime.UtcNow; var effective = request.EffectiveFrom?.ToUniversalTime() ?? now;
        var current = await db.HomestayPolicies.Where(x => x.HomestayId == homestayId && x.Status == "Active" && x.EffectiveTo == null).OrderByDescending(x => x.Version).FirstOrDefaultAsync();
        if (current is not null && effective <= current.EffectiveFrom) return Conflict(new { message = "Thời điểm hiệu lực phải sau phiên bản policy đang được lên lịch." });
        if (current is not null) current.EffectiveTo = effective;
        var version = (await db.HomestayPolicies.Where(x => x.HomestayId == homestayId).MaxAsync(x => (int?)x.Version) ?? 0) + 1;
        var policy = new HomestayPolicy { HomestayId = homestayId, Version = version, HoldMinutes = request.HoldMinutes, ReviewCreateDays = request.ReviewCreateDays, ReviewEditDays = request.ReviewEditDays,
            CommissionRate = request.CommissionRate, GuestDowngradeRefundMode = request.GuestDowngradeRefundMode, GuestDowngradeRefundPercent = request.GuestDowngradeRefundPercent,
            AutoApproveLateCheckoutWithoutNextBooking = request.AutoApproveLateCheckoutWithoutNextBooking,
            OperationalPolicyJson = JsonSerializer.Serialize(request.Document ?? OperationalPolicyDocument.SunriseGardenDefault()),
            EffectiveFrom = effective, Status = "Active", CreatedBy = UserId, CreatedAt = now };
        foreach (var tier in request.CancellationTiers) policy.CancellationTiers.Add(new CancellationPolicyTier { MinimumDays = tier.MinimumDays, MaximumDays = tier.MaximumDays, RefundPercent = tier.RefundPercent });
        foreach (var tier in request.LateCheckoutTiers) policy.LateCheckoutTiers.Add(new LateCheckoutFeeTier { FromMinutes = tier.FromMinutes, ToMinutes = tier.ToMinutes, CalculationType = tier.CalculationType, Value = tier.Value });
        db.HomestayPolicies.Add(policy); db.AuditLogs.Add(new AuditLog { ActorId = UserId, ActorRole = "Host", Action = "booking_policy.created", TargetType = "Homestay", TargetId = homestayId.ToString(), AfterJson = JsonSerializer.Serialize(request), CreatedAt = now, Ip = HttpContext.Connection.RemoteIpAddress });
        await db.SaveChangesAsync(); await tx.CommitAsync(); return Ok(await policies.Resolve(homestayId, DateTime.UtcNow));
    }

    private Task<bool> Owns(long id) => db.Homestays.AnyAsync(x => x.Id == id && x.HostId == UserId);
    private static string? Validate(SavePolicyRequest r)
    {
        if (r.HoldMinutes is < 5 or > 120 || r.ReviewCreateDays is < 1 or > 90 || r.ReviewEditDays is < 0 or > 90 || r.CommissionRate is < 0 or > 1) return "Thông số chung ngoài phạm vi cho phép.";
        if (r.GuestDowngradeRefundMode is not ("None" or "Full" or "Percent") || r.GuestDowngradeRefundPercent is < 0 or > 100) return "Chính sách hoàn chênh lệch không hợp lệ.";
        if (r.CancellationTiers.Count == 0 || r.CancellationTiers.Any(x => x.MinimumDays < 0 || x.MaximumDays < x.MinimumDays || x.RefundPercent is < 0 or > 100)) return "Các mức hủy không hợp lệ.";
        if (r.LateCheckoutTiers.Count == 0 || r.LateCheckoutTiers.Any(x => x.FromMinutes < 1 || x.ToMinutes < x.FromMinutes || x.CalculationType is not ("Fixed" or "NightlyPercent") || x.Value < 0)) return "Các mức late checkout không hợp lệ.";
        if (HasOverlap(r.CancellationTiers.Select(x => (x.MinimumDays, x.MaximumDays)))) return "Các khoảng ngày hủy bị chồng lấn.";
        if (HasOverlap(r.LateCheckoutTiers.Select(x => (x.FromMinutes, x.ToMinutes)))) return "Các khoảng late checkout bị chồng lấn.";
        if (r.Document is not null)
        {
            var d = r.Document;
            if (d.Payment.StandardDepositPercent is < 0 or > 100 || d.Payment.VillaDepositPercent is < 0 or > 100 || d.Payment.HolidayDepositPercent is < 0 or > 100)
                return "Tỷ lệ đặt cọc phải nằm trong khoảng 0–100%.";
            if (d.Guests.AdultAge is < 1 or > 18 || d.Guests.ChildFeeTiers.Count == 0 ||
                d.Guests.ChildFeeTiers.Any(x => x.MinimumAge < 0 || x.MaximumAgeExclusive <= x.MinimumAge || x.Percent is < 0 or > 100) ||
                HasOverlap(d.Guests.ChildFeeTiers.Select(x => (x.MinimumAge, (int?)x.MaximumAgeExclusive - 1))))
                return "Các mức phụ thu trẻ em không hợp lệ hoặc bị chồng lấn.";
            if (d.SeasonalSurcharges.Any(x => string.IsNullOrWhiteSpace(x.Code) || string.IsNullOrWhiteSpace(x.Name) || x.Percent < 0 || x.EndDate < x.StartDate))
                return "Phụ thu theo ngày không hợp lệ.";
            if (d.Promotions.EarlyBirdPercent is < 0 or > 100 || d.Promotions.LongStayPercent is < 0 or > 100 || d.Promotions.ExtendedStayPercent is < 0 or > 100)
                return "Tỷ lệ khuyến mãi phải nằm trong khoảng 0–100%.";
            if (d.DayUse.DepositPercent is < 0 or > 100 || d.Pets.MaximumPerRoom < 0 || d.Pets.FeePerNight < 0)
                return "Chính sách day-use hoặc thú cưng không hợp lệ.";
        }
        return null;
    }
    private static bool HasOverlap(IEnumerable<(int From, int? To)> ranges)
    {
        var ordered = ranges.OrderBy(x => x.From).ToList();
        for (var i = 1; i < ordered.Count; i++) if ((ordered[i - 1].To ?? int.MaxValue) >= ordered[i].From) return true;
        return false;
    }
}

[ApiController, Route("api/homestays/{homestayId:long}/effective-policies")]
public sealed class PublicHomestayPoliciesController(AppDbContext db, PolicyService policies) : ControllerBase
{
    [AllowAnonymous, HttpGet]
    public async Task<IActionResult> Get(long homestayId)
    {
        if (!await db.Homestays.AnyAsync(x => x.Id == homestayId && x.Status == "Approved")) return NotFound();
        return Ok(await policies.Resolve(homestayId, DateTime.UtcNow));
    }
}
