namespace HomestayAuth.Api.Features.Recommendations;

public sealed record ScoringInput(decimal? TotalBudget, decimal EstimatedTotal, int PreferredAmenities, int MatchingAmenities,
    double? AverageRating, int ReviewCount, int ConfirmedBookings, int RecentViews);

// Pure Top-K score (no database). ai/topk/model.mjs mirrors these formulas so weights learned offline mean the
// same thing online; the golden cases in tests/BookingRules.Checks and ai/topk/model.test.mjs keep them in sync.
public static class RecommendationScoring
{
    public const double PriorRating = 4;
    public const int PriorReviews = 5;
    public const decimal NoBudgetReference = 10_000_000m;

    public static double PriceFit(decimal? totalBudget, decimal estimatedTotal) => Math.Clamp(totalBudget is > 0
        ? (double)(1 - Math.Abs(totalBudget.Value - estimatedTotal) / totalBudget.Value)
        : (double)(1 - estimatedTotal / NoBudgetReference), 0, 1);

    public static double AmenityFit(int preferred, int matching) => preferred <= 0 ? 0 : (double)matching / preferred;

    // Bayesian average toward 4★ with the weight of 5 reviews, mapped from 1–5★ to 0–1.
    public static double RatingFit(double? averageRating, int reviewCount)
    {
        var smoothed = ((averageRating ?? PriorRating) * reviewCount + PriorRating * PriorReviews) / (reviewCount + PriorReviews);
        return Math.Clamp((smoothed - 1) / 4, 0, 1);
    }

    // Confirmed bookings are the strong signal (70%), views of the same session a light one (30%).
    public static double HistoryFit(int confirmedBookings, int recentViews) => Math.Min(1,
        0.7 * Math.Log(1 + confirmedBookings * 3d) / Math.Log(11) + 0.3 * Math.Log(1 + recentViews) / Math.Log(6));

    public static double Score(RecommendationWeights weights, ScoringInput input)
    {
        var totalWeight = Math.Max(1, weights.Price + weights.Amenities + weights.Rating + weights.History);
        return Math.Round(100 / totalWeight * (weights.Price * PriceFit(input.TotalBudget, input.EstimatedTotal)
            + weights.Amenities * AmenityFit(input.PreferredAmenities, input.MatchingAmenities)
            + weights.Rating * RatingFit(input.AverageRating, input.ReviewCount)
            + weights.History * HistoryFit(input.ConfirmedBookings, input.RecentViews)), 2);
    }
}
