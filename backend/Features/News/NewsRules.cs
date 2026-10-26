using System.Globalization;
using System.Net.Mail;
using System.Text;
using HomestayAuth.Api.Domain.Entities;

namespace HomestayAuth.Api.Features.News;

// Pure news/newsletter rules (no database), covered by tests/BookingRules.Checks.
public static class NewsRules
{
    public const int TitleMax = 150;
    public const int SummaryMax = 300;
    public const int ContentMax = 20_000;
    public static readonly string[] Categories = [NewsCategory.Guide, NewsCategory.Destination, NewsCategory.Offer, NewsCategory.Tripio];
    public static readonly string[] Statuses = [NewsStatus.Draft, NewsStatus.Published, NewsStatus.Hidden];

    /// <summary>"Đà Lạt mùa thấp điểm!" → "da-lat-mua-thap-diem" (max 120 chars).</summary>
    public static string Slugify(string? value)
    {
        var source = (value ?? "").Trim().ToLowerInvariant().Replace('đ', 'd').Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(source.Length);
        foreach (var c in source)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            if (c is >= 'a' and <= 'z' or >= '0' and <= '9') builder.Append(c);
            else if (builder.Length > 0 && builder[^1] != '-') builder.Append('-');
        }
        var slug = builder.ToString().Trim('-');
        if (slug.Length > 120) slug = slug[..120].TrimEnd('-');
        return slug;
    }

    /// <summary>Only published posts whose publish time has come are public.</summary>
    public static bool IsPublic(string status, DateTime? publishedAt, DateTime nowUtc) =>
        status == NewsStatus.Published && publishedAt.HasValue && publishedAt.Value <= nowUtc;

    public static string? Validate(string? title, string? summary, string? content, string? category, string? status)
    {
        if (string.IsNullOrWhiteSpace(title) || title.Trim().Length > TitleMax) return $"Tiêu đề bắt buộc, tối đa {TitleMax} ký tự.";
        if (string.IsNullOrWhiteSpace(summary) || summary.Trim().Length > SummaryMax) return $"Tóm tắt bắt buộc, tối đa {SummaryMax} ký tự.";
        if (string.IsNullOrWhiteSpace(content) || content.Length > ContentMax) return $"Nội dung bắt buộc, tối đa {ContentMax:N0} ký tự.";
        if (!Categories.Contains(category)) return "Danh mục không hợp lệ.";
        if (!Statuses.Contains(status)) return "Trạng thái không hợp lệ.";
        return null;
    }

    /// <summary>Lower-cased, trimmed email, or null when it is not a usable address.</summary>
    public static string? NormalizeEmail(string? value)
    {
        var email = value?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email) || email.Length > 254 || email.Contains(' ')) return null;
        return MailAddress.TryCreate(email, out var parsed) && parsed.Address == email && email.Contains('.') ? email : null;
    }
}
