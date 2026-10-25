import test from 'node:test';
import assert from 'node:assert/strict';
import { rankHomestays, score, DEFAULT_WEIGHTS } from './model.mjs';

const catalog = [
  { id: 1, name: 'A', province: 'Đà Nẵng', district: 'Sơn Trà', averageRating: 5, reviewCount: 1,
    amenities: ['WiFi', 'Hồ bơi'], roomTypes: [{ id: 11, name: 'Đôi', basePrice: 700000, baseCapacity: 2, maxCapacity: 2, maxAdults: 2, availableRoomCount: 2 }] },
  { id: 2, name: 'B', province: 'Đà Nẵng', district: 'Sơn Trà', averageRating: 4, reviewCount: 10,
    amenities: ['WiFi'], roomTypes: [{ id: 21, name: 'Đôi', basePrice: 500000, baseCapacity: 2, maxCapacity: 2, maxAdults: 2, availableRoomCount: 1 }] },
];

test('filters by actual room capacity, count, location and stay budget before ranking', () => {
  const query = { province: 'Da Nang', guests: 2, adults: 2, rooms: 2, nights: 2, totalBudget: 3000000 };
  assert.deepEqual(rankHomestays(catalog, query).map((item) => item.homestayId), [1]);
  assert.deepEqual(rankHomestays(catalog, { ...query, totalBudget: 2000000 }), []);
});

test('amenity preference changes order; hard amenity requirement excludes missing properties', () => {
  const query = { province: 'Đà Nẵng', guests: 2, adults: 2, rooms: 1, nights: 2, totalBudget: 2000000 };
  assert.equal(rankHomestays(catalog, { ...query, preferredAmenities: ['Hồ bơi'] })[0].homestayId, 1);
  assert.deepEqual(rankHomestays(catalog, { ...query, requiredAmenities: ['Hồ bơi'] }).map((item) => item.homestayId), [1]);
});

test('applies the booking occupancy rules: small children are free, tall children pay, extras are capped', () => {
  const familyCatalog = [{ id: 3, name: 'Family', province: 'Đà Nẵng', district: 'Sơn Trà', amenities: [],
    roomTypes: [{ id: 31, name: 'Gia đình', basePrice: 900000, baseCapacity: 4, maxCapacity: 4, extraGuestAllowed: false,
      extraChildFee: 100000, maxExtraChildren: 1, availableRoomCount: 1 }] }];
  const rank = (query) => rankHomestays(familyCatalog, { rooms: 1, nights: 2, ...query });
  assert.equal(rank({ guests: 5, adults: 4, children: 1, smallChildren: 1 })[0].estimatedTotal, 1800000);
  assert.equal(rank({ guests: 5, adults: 4, children: 1, tallChildren: 1 })[0].estimatedTotal, 2000000);
  assert.equal(rank({ guests: 5, adults: 4, children: 1 })[0].estimatedTotal, 2000000, 'undeclared children count as tall');
  assert.equal(rank({ guests: 6, adults: 4, children: 2, smallChildren: 2 }).length, 0, 'over MaxExtraChildren');
  assert.equal(rank({ guests: 5, adults: 5, children: 0 }).length, 0, 'extra adults need a larger room');
});

// Golden cases shared with tests/BookingRules.Checks (RecommendationScoring) — change both together.
test('score matches the backend RecommendationScoring golden cases', () => {
  assert.equal(score(DEFAULT_WEIGHTS, { totalBudget: 2000000, estimatedTotal: 1800000, preferredAmenities: 2,
    matchingAmenities: 1, averageRating: 4.5, reviewCount: 3, confirmedBookings: 1, recentViews: 2 }), 72.82);
  assert.equal(score(DEFAULT_WEIGHTS, { totalBudget: 0, estimatedTotal: 3000000, preferredAmenities: 0,
    matchingAmenities: 0, averageRating: null, reviewCount: 0, confirmedBookings: 0, recentViews: 0 }), 43);
});
