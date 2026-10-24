namespace HomestayAuth.Api.Features.Homestays.Services;

// Shared validation for user-supplied images: uploads are checked by their actual bytes (not only the
// file name and the Content-Type the client claims), and stored image URLs must be plain web links.
public static class ImageUpload
{
    public const long MaxBytes = 8_000_000;
    public const int MaxUrlLength = 500;

    private static readonly Dictionary<string, string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg",
        [".png"] = "image/png", [".webp"] = "image/webp"
    };

    /// <summary>Returns the normalized extension and content type, or null when the file is not a real JPG/PNG/WEBP.</summary>
    public static async Task<(string Extension, string ContentType)?> Validate(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length is <= 0 or > MaxBytes) return null;
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedTypes.TryGetValue(extension, out var contentType) ||
            !string.Equals(file.ContentType, contentType, StringComparison.OrdinalIgnoreCase)) return null;

        var header = new byte[12];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
        return MatchesSignature(header.AsSpan(0, read), contentType) ? (extension, contentType) : null;
    }

    public static bool MatchesSignature(ReadOnlySpan<byte> header, string contentType) => contentType switch
    {
        "image/jpeg" => header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF,
        "image/png" => header.StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
        "image/webp" => header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8),
        _ => false
    };

    /// <summary>Accepts only absolute https links (http for local development) that fit the image_url column.</summary>
    public static bool IsAllowedUrl(string? value)
    {
        var url = value?.Trim();
        if (string.IsNullOrEmpty(url) || url.Length > MaxUrlLength) return false;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return false;
        return uri.Scheme == Uri.UriSchemeHttps || (uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback);
    }
}
