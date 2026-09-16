import { apiClient } from '../../../shared/api/apiClient.js';
export const adminApi = {
  overview: () => apiClient('/admin/overview'),
  homestays: () => apiClient('/admin/homestays'),
  decideHomestay: (id, action, reason = '') => apiClient(`/admin/homestays/${id}/${action}`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  users: () => apiClient('/admin/users'),
  toggleUser: (id) => apiClient(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({}) })
};
