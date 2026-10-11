import { rankHomestays, DEFAULT_WEIGHTS } from './model.mjs';

export const ATTRIBUTION_DAYS = 7;

export function parseQuery(event) {
  try {
    const data = typeof event.queryData === 'string' ? JSON.parse(event.queryData) : event.queryData;
    const checkIn = data?.checkIn;
    const checkOut = data?.checkOut;
    const nights = checkIn && checkOut ? Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000)) : 1;
    return { search: data?.search || data?.location || '', guests: data?.guests || 2,
      adults: data?.adults ?? Math.max(1, (data?.guests || 2) - (data?.children || 0)), children: data?.children || 0,
      rooms: data?.rooms || 1, nights, totalBudget: data?.totalBudget || 0,
      preferredAmenities: data?.amenities || [], recommendedIds: data?.recommendedIds || [] };
  } catch { return null; }
}

export function buildExamples(events, attributionDays = ATTRIBUTION_DAYS) {
  const real = events.filter((event) => event.source === 'real').map((event) => ({ ...event, at: new Date(event.occurredAt) }))
    .sort((a, b) => a.at - b.at || Number(a.id) - Number(b.id));
  const searches = real.filter((event) => event.eventType === 'search');
  const bookings = real.filter((event) => event.eventType === 'booking' && event.homestayId);
  return bookings.flatMap((booking) => {
    const eligibleSearches = searches.filter((item) => item.sessionId === booking.sessionId && item.at <= booking.at
      && item.at >= new Date(booking.at.getTime() - attributionDays * 86400000));
    const search = eligibleSearches.at(-1);
    if (!search) return [];
    const query = parseQuery(search);
    if (!query) return [];
    const history = real.filter((event) => event.at < search.at && event.homestayId
      && (event.customerId ? event.customerId === search.customerId : event.sessionId === search.sessionId))
      .map((event) => ({ homestayId: event.homestayId, action: event.eventType }));
    return [{ groupKey: search.customerId ? `user:${search.customerId}` : `session:${search.sessionId}`,
      occurredAt: search.at.toISOString(), sessionId: search.sessionId, query, history,
      bookedHomestayId: Number(booking.homestayId) }];
  });
}

export function splitByTimeAndGroup(examples, ratios = [0.6, 0.2, 0.2]) {
  const groups = new Map();
  for (const example of examples) {
    const group = groups.get(example.groupKey) || [];
    group.push(example); groups.set(example.groupKey, group);
  }
  const ordered = [...groups.values()].sort((a, b) => new Date(a.at(-1).occurredAt) - new Date(b.at(-1).occurredAt));
  const total = ordered.reduce((sum, group) => sum + group.length, 0);
  const targets = [total * ratios[0], total * (ratios[0] + ratios[1])];
  const result = { train: [], validation: [], test: [] };
  let seen = 0;
  for (const group of ordered) {
    const bucket = seen < targets[0] ? 'train' : seen < targets[1] ? 'validation' : 'test';
    result[bucket].push(...group); seen += group.length;
  }
  return result;
}

export function evaluate(examples, catalog, options = {}) {
  const uniqueRecommended = new Set();
  let hits = 0, dcg = 0;
  for (const example of examples) {
    const ranked = options.strategy === 'logged'
      ? example.query.recommendedIds.slice(0, 5).map((homestayId) => ({ homestayId: Number(homestayId) }))
      : rankHomestays(catalog, example.query, example.history, 5, options);
    ranked.forEach((item) => uniqueRecommended.add(Number(item.homestayId)));
    const rank = ranked.findIndex((item) => Number(item.homestayId) === example.bookedHomestayId);
    if (rank >= 0) { hits++; dcg += 1 / Math.log2(rank + 2); }
  }
  const count = examples.length;
  return { samples: count, recallAt5: count ? hits / count : 0, ndcgAt5: count ? dcg / count : 0,
    coverage: catalog.length ? uniqueRecommended.size / catalog.length : 0 };
}

export function observedConversion(events, attributionDays = ATTRIBUTION_DAYS) {
  const real = events.filter((event) => event.source === 'real');
  const searches = real.filter((event) => event.eventType === 'search');
  const bookings = real.filter((event) => event.eventType === 'booking');
  const converted = searches.filter((search) => bookings.some((booking) => booking.sessionId === search.sessionId
    && new Date(booking.occurredAt) >= new Date(search.occurredAt)
    && new Date(booking.occurredAt) <= new Date(new Date(search.occurredAt).getTime() + attributionDays * 86400000)
    && !searches.some((later) => later.sessionId === search.sessionId
      && new Date(later.occurredAt) > new Date(search.occurredAt) && new Date(later.occurredAt) <= new Date(booking.occurredAt))));
  return { searches: searches.length, convertedSearches: converted.length,
    conversionRate: searches.length ? converted.length / searches.length : 0 };
}

export function candidateWeights() {
  const values = [10, 20, 30, 40, 50, 60];
  const candidates = [DEFAULT_WEIGHTS];
  for (const price of values) for (const amenities of values) for (const rating of values) {
    const history = 100 - price - amenities - rating;
    if (history >= 0 && history <= 40) candidates.push({ price, amenities, rating, history });
  }
  return candidates;
}
