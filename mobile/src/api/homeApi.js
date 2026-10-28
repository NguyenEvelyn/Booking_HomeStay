import { apiClient } from './client.js';

// One id per app launch, like the web's recommendationSessionId(): it ties the search/view events the
// recommender logs to this visit.
const sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = (Math.random() * 16) | 0;
  return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
});

export const homeApi = {
  // Same request as the web hero: top 4 picks for 2 adults, 1 room.
  heroPicks: () => apiClient(`/recommendations?${new URLSearchParams({ topK: 4, guests: 2, adults: 2, children: 0, rooms: 1, sessionId })}`),
  topRated: () => apiClient('/homestays?pageSize=8&sort=rating'),
  banners: () => apiClient('/home/banners?placement=HomeHero'),
  deals: () => apiClient('/deals?limit=8'),
  vouchers: () => apiClient('/vouchers')
};
