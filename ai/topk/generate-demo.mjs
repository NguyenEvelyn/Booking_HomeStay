import { mkdir, writeFile } from 'node:fs/promises';
import { rankHomestays } from './model.mjs';

const baseUrl = process.env.BOOKING_API_URL || 'http://localhost:5000/api';
const seed = Number(process.env.DEMO_SEED) || 20260920;
let state = seed >>> 0;
const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32);
const choose = (values) => values[Math.floor(random() * values.length)];
const getJson = async (path) => {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};

const page = await getJson('/homestays?page=1&pageSize=50');
const catalog = (await Promise.all(page.items.map(async (item) => {
  const detail = await getJson(`/homestays/${item.id}`);
  return {
    id: item.id, name: item.name, province: item.province, district: item.district,
    averageRating: item.averageRating, reviewCount: item.reviewCount,
    amenities: detail.amenities.map((amenity) => amenity.name),
    roomTypes: detail.roomTypes.map(({ id, name, basePrice, baseCapacity, maxCapacity,
      maxAdults, maxChildren, extraGuestAllowed, extraGuestFee, availableRoomCount }) => ({ id, name, basePrice,
      baseCapacity, maxCapacity, maxAdults, maxChildren, extraGuestAllowed, extraGuestFee, availableRoomCount })),
  };
}))).sort((a, b) => a.id - b.id);
if (!catalog.length) throw new Error('Neon catalog has no approved homestays.');

const events = [];
const today = new Date();
for (let session = 1; session <= 300; session++) {
  const target = choose(catalog);
  const roomType = choose(target.roomTypes);
  const guests = Math.max(1, Math.min(roomType.baseCapacity, roomType.maxAdults));
  const nights = 1 + Math.floor(random() * 4);
  const budget = Math.ceil(roomType.basePrice * nights * (1.05 + random() * .55) / 100000) * 100000;
  const checkIn = new Date(today);
  checkIn.setDate(checkIn.getDate() + 7 + Math.floor(random() * 60));
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + nights);
  const stamp = new Date(today.getTime() - Math.floor(random() * 90) * 86400000).toISOString();
  const sessionId = `demo-session-${String(session).padStart(4, '0')}`;
  const userId = `demo-user-${String(1 + Math.floor(random() * 80)).padStart(3, '0')}`;
  const query = { province: target.province, district: random() < .3 ? target.district : '',
    guests, adults: guests, rooms: 1, nights, totalBudget: budget,
    preferredAmenities: target.amenities.length ? [choose(target.amenities)] : [],
    checkIn: checkIn.toISOString().slice(0, 10), checkOut: checkOut.toISOString().slice(0, 10) };
  events.push({ sessionId, userId, at: stamp, action: 'search', query });
  const candidates = rankHomestays(catalog, query, [], 20);
  if (candidates.length && random() < .78) {
    const targetCandidate = candidates.find((candidate) => candidate.homestayId === target.id);
    const viewed = targetCandidate && random() < .7 ? targetCandidate : choose(candidates);
    events.push({ sessionId, userId, at: stamp, action: 'view', homestayId: viewed.homestayId });
    if (random() < .18) events.push({ sessionId, userId, at: stamp, action: 'booking', homestayId: viewed.homestayId });
  }
}

await mkdir(new URL('./data/', import.meta.url), { recursive: true });
await writeFile(new URL('./data/catalog.json', import.meta.url), JSON.stringify({ source: 'public Neon catalog', exportedAt: today.toISOString(), items: catalog }, null, 2));
await writeFile(new URL('./data/demo-events.jsonl', import.meta.url), events.map((event) => JSON.stringify(event)).join('\n') + '\n');
console.log(`Exported ${catalog.length} real homestays and ${events.length} synthetic events. Neon data was not modified.`);
