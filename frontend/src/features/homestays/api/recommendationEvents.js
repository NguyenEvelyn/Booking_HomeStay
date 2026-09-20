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

export function recordRecommendationEvent(event) {
  return apiClient('/recommendation-events', {
    method: 'POST',
    body: JSON.stringify({ ...event, sessionId: recommendationSessionId() })
  }).catch(() => {});
}
