import { apiClient } from '../../../shared/api/apiClient.js';
const query = values => { const params = new URLSearchParams(); Object.entries(values||{}).forEach(([key,value])=>{if(value!==''&&value!==null&&value!==undefined)params.set(key,value)}); const text=params.toString(); return text?`?${text}`:''; };
export const adminApi = {
  overview: () => apiClient('/admin/overview'),
  dashboard: (filters) => apiClient(`/admin/dashboard${query(filters)}`),
  recommendationSummary: () => apiClient('/recommendation-events/summary?days=30'),
  recommendationExport: (days = 365) => apiClient(`/recommendation-events/export?days=${days}`),
  homestays: (filters) => apiClient(`/admin/homestays${query(filters)}`),
  homestayFilters: () => apiClient('/admin/homestays/filters'),
  homestayDetail: (id) => apiClient(`/admin/homestays/${id}`),
  decideHomestay: (id, action, reason = '') => apiClient(`/admin/homestays/${id}/${action}`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  setHomestayFeatured: (id, isFeatured) => apiClient(`/admin/homestays/${id}/featured`, { method: 'PATCH', body: JSON.stringify({ isFeatured }) }),
  users: (filters) => apiClient(`/admin/users${query(filters)}`),
  userDetail: (id, filters) => apiClient(`/admin/users/${id}${query(filters)}`),
  toggleUser: (id, reason = '') => apiClient(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  requestPasswordReset: (id, reason) => apiClient(`/admin/users/${id}/password-reset`, { method: 'POST', body: JSON.stringify({ reason }) }),
  auditLogs: (filters) => apiClient(`/admin/audit-logs${query(filters)}`),
  auditLogDetail: (id) => apiClient(`/admin/audit-logs/${id}`),
  auditFilters: () => apiClient('/admin/audit-logs/filters')
  ,bookings: filters => apiClient(`/admin/bookings${query(filters)}`)
  ,bookingDetail: id => apiClient(`/admin/bookings/${id}`)
  ,bookingStatus: (id,status,reason) => apiClient(`/admin/bookings/${id}/status`,{method:'PATCH',body:JSON.stringify({status,reason})})
  ,cancelBooking: (id,reason) => apiClient(`/admin/bookings/${id}/cancel`,{method:'POST',body:JSON.stringify({reason})})
  ,overbooking: filters => apiClient(`/admin/bookings/overbooking${query(filters)}`)
  ,payments: filters => apiClient(`/admin/payments${query(filters)}`)
  ,refunds: filters => apiClient(`/admin/payments/refunds${query(filters)}`)
  ,hostReport: filters => apiClient(`/admin/payments/host-report${query(filters)}`)
  ,syncPayment: (id,reason) => apiClient(`/admin/payments/${id}/sync`,{method:'POST',body:JSON.stringify({reason})})
};
