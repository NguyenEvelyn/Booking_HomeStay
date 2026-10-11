import test from 'node:test';
import assert from 'node:assert/strict';
import { rankHomestays } from './model.mjs';

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

test('filters by adult and child capacity independently', () => {
  const familyCatalog = [{ id: 3, name: 'Family', province: 'Đà Nẵng', district: 'Sơn Trà', amenities: [],
    roomTypes: [{ id: 31, name: 'Gia đình', basePrice: 900000, baseCapacity: 4, maxCapacity: 4,
      maxAdults: 2, maxChildren: 2, availableRoomCount: 1 }] }];
  assert.equal(rankHomestays(familyCatalog, { guests: 4, adults: 2, children: 2, rooms: 1 }).length, 1);
  assert.equal(rankHomestays(familyCatalog, { guests: 4, adults: 3, children: 1, rooms: 1 }).length, 0);
});
