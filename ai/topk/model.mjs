const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/đ/g, 'd').trim();
const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const DEFAULT_WEIGHTS = Object.freeze({ price: 40, amenities: 30, rating: 20, history: 10 });

// Same formulas as backend/Features/Recommendations/RecommendationScoring.cs; the golden cases in
// model.test.mjs and tests/BookingRules.Checks pin both sides to the same numbers.
export const priceFit = (totalBudget, estimatedTotal) => clamp01(totalBudget > 0
  ? 1 - Math.abs(totalBudget - estimatedTotal) / totalBudget
  : 1 - estimatedTotal / 10000000);
export const amenityFit = (preferred, matching) => (preferred > 0 ? matching / preferred : 0);
export const ratingFit = (averageRating, reviewCount) => {
  const count = Number(reviewCount) || 0;
  const smoothed = ((averageRating ?? 4) * count + 4 * 5) / (count + 5);
  return clamp01((smoothed - 1) / 4);
};
export const historyFit = (confirmedBookings, recentViews) => Math.min(1,
  0.7 * Math.log(1 + confirmedBookings * 3) / Math.log(11) + 0.3 * Math.log(1 + recentViews) / Math.log(6));

export function score(weights, input) {
  const total = Math.max(1, weights.price + weights.amenities + weights.rating + weights.history);
  const raw = (100 / total) * (weights.price * priceFit(input.totalBudget, input.estimatedTotal)
    + weights.amenities * amenityFit(input.preferredAmenities, input.matchingAmenities)
    + weights.rating * ratingFit(input.averageRating, input.reviewCount)
    + weights.history * historyFit(input.confirmedBookings, input.recentViews));
  return Math.round(raw * 100) / 100;
}

// Mirrors OccupancyRules.FromCounts without ages: undeclared children are charged as tall (from 1.2 m).
export function partyOf(query) {
  const guests = Math.max(1, Number(query.guests) || 1);
  const children = Math.max(0, Number(query.children) || 0);
  const adults = query.adults == null ? Math.max(1, guests - children) : Number(query.adults);
  if (query.tallChildren != null || query.smallChildren != null)
    return { adults, tall: Math.max(0, Number(query.tallChildren) || 0), small: Math.max(0, Number(query.smallChildren) || 0) };
  return { adults, tall: children, small: 0 };
}

// Mirrors OccupancyRules.Evaluate; returns null when the party does not fit.
export function evaluateOccupancy(party, quantity, roomType) {
  const rooms = Math.max(1, quantity);
  const baseCapacity = Number(roomType.baseCapacity) || 0;
  const standard = Math.max(1, baseCapacity) * rooms;
  const adultLimit = (roomType.extraGuestAllowed ? Math.max(baseCapacity, Number(roomType.maxCapacity) || 0) : baseCapacity) * rooms;
  const maxExtra = Math.max(0, roomType.maxExtraChildren ?? 2) * rooms;
  if (party.adults < rooms || party.adults > adultLimit) return null;
  const extraAdults = Math.max(0, party.adults - standard);
  const extraTall = Math.max(0, party.adults + party.tall - standard) - extraAdults;
  if (extraTall + party.small > maxExtra) return null;
  return { extraAdults, extraTall };
}

export function rankHomestays(catalog, query, history = [], k = 5, options = {}) {
  const guests = Math.max(1, Number(query.guests) || 1);
  const rooms = Math.max(1, Number(query.rooms) || 1);
  const nights = Math.max(1, Number(query.nights) || 1);
  const budget = Number(query.totalBudget) || 0;
  const party = partyOf(query);
  const desired = (query.preferredAmenities || []).map(normalize).filter(Boolean);
  const required = (query.requiredAmenities || []).map(normalize).filter(Boolean);
  const province = normalize(query.province);
  const district = normalize(query.district);
  const search = normalize(query.search);
  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };

  return catalog.flatMap((homestay) => {
    if (province && normalize(homestay.province) !== province) return [];
    if (district && normalize(homestay.district) !== district) return [];
    if (search && ![homestay.name, homestay.province, homestay.district].some((value) => normalize(value).includes(search))) return [];
    const amenities = new Set((homestay.amenities || []).map(normalize));
    if (required.some((amenity) => !amenities.has(amenity))) return [];

    // A candidate is a homestay with one room type that can hold the whole group. The offline snapshot only has
    // base prices (no price periods, seasonal surcharges or promotions), so the estimate is approximate.
    const estimate = (roomType, occupancy) => (roomType.basePrice * rooms + occupancy.extraAdults * (roomType.extraGuestFee || 0)
      + occupancy.extraTall * (roomType.extraChildFee || 0)) * nights;
    const eligible = (homestay.roomTypes || []).flatMap((roomType) => {
      const occupancy = roomType.availableRoomCount >= rooms ? evaluateOccupancy(party, rooms, roomType) : null;
      return occupancy ? [{ roomType, total: estimate(roomType, occupancy) }] : [];
    }).filter((item) => !budget || item.total <= budget).sort((a, b) => a.total - b.total);
    if (!eligible.length) return [];
    const { roomType, total: estimatedTotal } = eligible[0];

    const matching = desired.filter((amenity) => amenities.has(amenity)).length;
    const own = history.filter((event) => event.homestayId === homestay.id);
    const itemScore = score(weights, { totalBudget: budget, estimatedTotal, preferredAmenities: desired.length,
      matchingAmenities: matching, averageRating: homestay.averageRating, reviewCount: homestay.reviewCount,
      confirmedBookings: own.filter((event) => event.action === 'booking').length,
      recentViews: own.filter((event) => event.action === 'view').length });
    const reasons = [
      `${rooms} × ${roomType.name} đủ cho ${guests} khách`,
      `${estimatedTotal.toLocaleString('vi-VN')}đ/${nights} đêm`,
      ...(matching ? ['Có tiện nghi bạn chọn'] : []),
    ];
    return [{ homestayId: homestay.id, name: homestay.name, province: homestay.province,
      district: homestay.district, roomTypeId: roomType.id, score: itemScore, estimatedTotal,
      ratingFit: ratingFit(homestay.averageRating, homestay.reviewCount), reasons }];
  }).sort(options.strategy === 'lowest-price'
    ? (a, b) => a.estimatedTotal - b.estimatedTotal || b.ratingFit - a.ratingFit || a.homestayId - b.homestayId
    : options.strategy === 'highest-rating'
      ? (a, b) => b.ratingFit - a.ratingFit || a.estimatedTotal - b.estimatedTotal || a.homestayId - b.homestayId
      : (a, b) => b.score - a.score || a.estimatedTotal - b.estimatedTotal || a.homestayId - b.homestayId)
    .slice(0, Math.max(1, Math.min(Number(k) || 5, 20)));
}
