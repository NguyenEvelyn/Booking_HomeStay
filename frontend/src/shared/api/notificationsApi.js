import { apiClient } from './apiClient.js';

export const notificationsApi = {
  list: (before) => apiClient(`/notifications?limit=20${before ? `&before=${before}` : ''}`),
  unreadCount: () => apiClient('/notifications/unread-count'),
  read: (id) => apiClient(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: () => apiClient('/notifications/read-all', { method: 'POST' })
};
