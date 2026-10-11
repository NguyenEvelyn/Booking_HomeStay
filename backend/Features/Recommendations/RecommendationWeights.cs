using System.Text.Json;

namespace HomestayAuth.Api.Features.Recommendations;

public sealed record RecommendationWeights(double Price, double Amenities, double Rating, double History,
    string Version, bool IsLearned)
{
    public static RecommendationWeights Baseline { get; } = new(40, 30, 20, 10, "baseline-40-30-20-10", false);

    public static RecommendationWeights Load(string contentRoot)
    {
        var configured = Environment.GetEnvironmentVariable("RECOMMENDATION_MODEL_PATH");
        var candidates = new[] { configured, Path.Combine(contentRoot, "ai", "topk", "data", "evaluation-report.json"),
            Path.GetFullPath(Path.Combine(contentRoot, "..", "ai", "topk", "data", "evaluation-report.json")) };
        var path = candidates.FirstOrDefault(candidate => !string.IsNullOrWhiteSpace(candidate) && File.Exists(candidate));
        if (path is null)
        {
            Console.WriteLine("[recommendations] Không có evaluation-report đủ điều kiện; dùng baseline 40/30/20/10.");
            return Baseline;
        }
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(path));
            var root = document.RootElement;
            if (!root.TryGetProperty("source", out var source) || source.GetString() != "real"
                || !root.TryGetProperty("promotionEligible", out var eligible) || !eligible.GetBoolean()
                || !root.TryGetProperty("selectedWeights", out var weights))
            {
                Console.WriteLine($"[recommendations] Report {path} chưa đủ điều kiện quảng bá; dùng baseline.");
                return Baseline;
            }
            var result = new RecommendationWeights(weights.GetProperty("price").GetDouble(),
                weights.GetProperty("amenities").GetDouble(), weights.GetProperty("rating").GetDouble(),
                weights.GetProperty("history").GetDouble(), $"learned-{File.GetLastWriteTimeUtc(path):yyyyMMddHHmmss}", true);
            return result.Price + result.Amenities + result.Rating + result.History > 0 ? result : Baseline;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine($"[recommendations] Không đọc được report {path}: {error.Message}; dùng baseline.");
            return Baseline;
        }
    }
}

public sealed class RecommendationWeightsProvider
{
    private readonly string contentRoot;
    private readonly object sync = new();
    private RecommendationWeights current;
    private DateTime nextRefreshUtc;

    public RecommendationWeightsProvider(string contentRoot)
    {
        this.contentRoot = contentRoot;
        current = RecommendationWeights.Load(contentRoot);
    }

    public RecommendationWeights Current
    {
        get
        {
            if (DateTime.UtcNow < nextRefreshUtc) return current;
            lock (sync)
            {
                if (DateTime.UtcNow < nextRefreshUtc) return current;
                var next = RecommendationWeights.Load(contentRoot);
                if (next.Version != current.Version)
                    Console.WriteLine($"[recommendations] Đổi model {current.Version} -> {next.Version}.");
                current = next;
                nextRefreshUtc = DateTime.UtcNow.AddMinutes(1);
                return current;
            }
        }
    }
}
