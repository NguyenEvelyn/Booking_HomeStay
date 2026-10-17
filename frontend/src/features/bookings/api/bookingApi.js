import { apiClient } from '../../../shared/api/apiClient.js';

export const bookingApi = {
  quote: (payload) => apiClient('/bookings/quote', { method: 'POST', body: JSON.stringify(payload) }),
  mine: () => apiClient('/bookings/mine'),
  detail: (id) => apiClient(`/bookings/${id}`),
  updateContact: (id, payload) => apiClient(`/bookings/${id}/contact`, { method: 'PATCH', body: JSON.stringify(payload) }),
  serviceRequests: (id) => apiClient(`/bookings/${id}/service-requests`),
  createServiceRequest: (id, payload) => apiClient(`/bookings/${id}/service-requests`, { method: 'POST', body: JSON.stringify(payload) }),
  confirmServiceCompleted: (id) => apiClient(`/bookings/service-requests/${id}/confirm-completed`, { method: 'PATCH', body: JSON.stringify({}) }),
  respondServiceProposal: (id, accepted) => apiClient(`/bookings/service-requests/${id}/proposal`, { method: 'PATCH', body: JSON.stringify({ accepted }) }),
  cancellationQuote: (id) => apiClient(`/bookings/${id}/cancellation-quote`),
  cancel: (id, reason) => apiClient(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  retryPayment: (id) => apiClient(`/bookings/${id}/retry-payment`, { method: 'POST' }),
  createReview: payload => apiClient('/reviews', { method: 'POST', body: JSON.stringify(payload) }),
  updateReview: (id,payload) => apiClient(`/reviews/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  createVnPayPayment: (payload) => apiClient('/bookings/vnpay', {
    method: 'POST', body: JSON.stringify(payload)
  })
};
