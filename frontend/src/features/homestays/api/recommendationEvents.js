import { apiClient } from '../../../shared/api/apiClient.js';

const key = 'tripio-recommendation-session';

export function recommendationSessionId() {
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function recordRecommendationEvent(event, legacyHomestayId = null) {
  const payload = typeof event === 'string'
    ? { eventType: event, homestayId: legacyHomestayId }
    : event;
  if (!payload || !['search', 'view'].includes(payload.eventType)) return Promise.resolve(null);
  return apiClient('/recommendation-events', {
    method: 'POST',
    body: JSON.stringify({ ...payload, sessionId: recommendationSessionId() })
  }).catch((error) => {
    if (import.meta.env.DEV) console.warn('[recommendation-events] Không thể ghi sự kiện:', payload.eventType, error);
    return null;
  });
}
