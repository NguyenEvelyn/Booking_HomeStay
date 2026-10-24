using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Homestays.Services;

namespace HomestayAuth.Api.Features.Admin;

// Pure validation for banners (no database); target existence is checked by the controller.
public static class BannerRules
{
    public const int MaxDurationDays = 90;

    public static string? Validate(string? title, string? subtitle, string? imageUrl, string? placement, string? targetType,
        long? targetId, string? targetQuery, DateTime startsAtUtc, DateTime endsAtUtc, int priority)
    {
        if (string.IsNullOrWhiteSpace(title) || title.Trim().Length is < 3 or > 80) return "Tiêu đề banner phải dài 3–80 ký tự.";
        if (subtitle?.Trim().Length > 160) return "Mô tả ngắn tối đa 160 ký tự.";
        if (!ImageUpload.IsAllowedUrl(imageUrl)) return "Ảnh banner phải là liên kết https hợp lệ (hãy tải ảnh lên).";
        if (placement is not (BannerPlacement.HomeHero or BannerPlacement.HomeDeals)) return "Vị trí hiển thị không hợp lệ.";
        if (targetType is not (BannerTarget.Deal or BannerTarget.Homestay or BannerTarget.Voucher or BannerTarget.Search)) return "Loại liên kết không hợp lệ.";
        if (targetType == BannerTarget.Search ? string.IsNullOrWhiteSpace(targetQuery) || targetQuery.Trim().Length > 100 : targetId is null or <= 0)
            return targetType == BannerTarget.Search ? "Banner tìm kiếm cần tên tỉnh/thành (tối đa 100 ký tự)." : "Banner cần chọn đối tượng liên kết.";
        if (endsAtUtc <= startsAtUtc) return "Thời gian kết thúc phải sau thời gian bắt đầu.";
        if ((endsAtUtc - startsAtUtc).TotalDays > MaxDurationDays) return $"Một banner chạy tối đa {MaxDurationDays} ngày.";
        if (priority is < 0 or > 100) return "Độ ưu tiên phải từ 0 đến 100.";
        return null;
    }

    public static bool IsLive(Banner banner, DateTime nowUtc) =>
        banner.Status == BannerStatus.Active && banner.StartsAt <= nowUtc && nowUtc < banner.EndsAt;
}
