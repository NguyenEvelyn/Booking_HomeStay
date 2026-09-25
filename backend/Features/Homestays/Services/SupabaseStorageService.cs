using System.Net.Http.Headers;

namespace HomestayAuth.Api.Features.Homestays.Services;

public sealed class SupabaseStorageService(HttpClient httpClient)
{
    private readonly string _baseUrl = Require("SUPABASE_URL").TrimEnd('/');
    private readonly string _secretKey = Require("SUPABASE_SECRET_KEY");
    private readonly string _bucket = Require("SUPABASE_STORAGE_BUCKET");

    public async Task<string> UploadPublicImageAsync(
        Stream content,
        string objectPath,
        string contentType,
        CancellationToken cancellationToken)
    {
        var encodedPath = string.Join('/', objectPath.Split('/').Select(Uri.EscapeDataString));
        var encodedBucket = Uri.EscapeDataString(_bucket);
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{_baseUrl}/storage/v1/object/{encodedBucket}/{encodedPath}");
        request.Headers.TryAddWithoutValidation("apikey", _secretKey);
        request.Headers.TryAddWithoutValidation("x-upsert", "false");
        request.Headers.CacheControl = new CacheControlHeaderValue
        {
            Public = true,
            MaxAge = TimeSpan.FromDays(365)
        };
        request.Content = new StreamContent(content);
        request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var details = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"Supabase Storage từ chối tải ảnh ({(int)response.StatusCode}): {details}");
        }

        return $"{_baseUrl}/storage/v1/object/public/{encodedBucket}/{encodedPath}";
    }

    private static string Require(string name) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"Thiếu biến môi trường {name}.");
}
