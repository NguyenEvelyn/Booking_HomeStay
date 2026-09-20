const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();
const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function rankHomestays(catalog, query, history = [], k = 5) {
  const guests = Math.max(1, Number(query.guests) || 1);
  const rooms = Math.max(1, Number(query.rooms) || 1);
  const nights = Math.max(1, Number(query.nights) || 1);
  const budget = Number(query.totalBudget) || 0;
  const desired = (query.preferredAmenities || []).map(normalize).filter(Boolean);
  const required = (query.requiredAmenities || []).map(normalize).filter(Boolean);
  const province = normalize(query.province);
  const district = normalize(query.district);

  return catalog.flatMap((homestay) => {
    if (province && normalize(homestay.province) !== province) return [];
    if (district && normalize(homestay.district) !== district) return [];
    const amenities = new Set((homestay.amenities || []).map(normalize));
    if (required.some((amenity) => !amenities.has(amenity))) return [];

    // A candidate is a homestay with one room type that can hold the whole group.
    const eligible = (homestay.roomTypes || []).filter((roomType) => {
      const capacity = roomType.extraGuestAllowed ? roomType.maxCapacity : roomType.baseCapacity;
      return capacity * rooms >= guests
        && (query.adults == null || roomType.maxAdults * rooms >= Number(query.adults))
        && (query.children == null || roomType.maxChildren * rooms >= Number(query.children))
        && roomType.availableRoomCount >= rooms;
    }).sort((a, b) => a.basePrice - b.basePrice);
    const estimate = (item) => (item.basePrice * rooms + Math.max(0, guests - item.baseCapacity * rooms) * (item.extraGuestFee || 0)) * nights;
    const roomType = eligible.find((item) => !budget || estimate(item) <= budget);
    if (!roomType) return [];

    const estimatedTotal = estimate(roomType);
    const priceFit = budget ? clamp01(1 - Math.abs(budget - estimatedTotal) / budget) : clamp01(1 - estimatedTotal / 10000000);
    const amenityFit = desired.length ? desired.filter((amenity) => amenities.has(amenity)).length / desired.length : 0;
    const reviewCount = Number(homestay.reviewCount) || 0;
    const rating = (Number(homestay.averageRating || 4) * reviewCount + 4 * 5) / (reviewCount + 5);
    const ratingFit = clamp01((rating - 1) / 4);
    const interactionWeight = history.filter((event) => event.homestayId === homestay.id)
      .reduce((sum, event) => sum + (event.action === 'booking' ? 3 : event.action === 'view' ? 1 : 0), 0);
    const historyFit = clamp01(Math.log1p(interactionWeight) / Math.log1p(10));
    const score = Math.round((40 * priceFit + 30 * amenityFit + 20 * ratingFit + 10 * historyFit) * 100) / 100;
    const reasons = [
      `${rooms} × ${roomType.name} đủ cho ${guests} khách`,
      `${estimatedTotal.toLocaleString('vi-VN')}đ/${nights} đêm`,
      ...(desired.filter((amenity) => amenities.has(amenity)).length ? ['Có tiện nghi bạn chọn'] : []),
    ];
    return [{ homestayId: homestay.id, name: homestay.name, province: homestay.province,
      district: homestay.district, roomTypeId: roomType.id, score, estimatedTotal, reasons }];
  }).sort((a, b) => b.score - a.score || a.estimatedTotal - b.estimatedTotal || a.homestayId - b.homestayId)
    .slice(0, Math.max(1, Math.min(Number(k) || 5, 20)));
}
