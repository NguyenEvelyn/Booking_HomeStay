import { apiClient } from '../../../shared/api/apiClient.js';
export const adminApi = {
  overview: () => apiClient('/admin/overview'),
  recommendationSummary: () => apiClient('/recommendation-events/summary?days=30'),
  homestays: () => apiClient('/admin/homestays'),
  homestayDetail: (id) => apiClient(`/admin/homestays/${id}`),
  decideHomestay: (id, action, reason = '') => apiClient(`/admin/homestays/${id}/${action}`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  users: () => apiClient('/admin/users'),
  toggleUser: (id) => apiClient(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({}) })
};
