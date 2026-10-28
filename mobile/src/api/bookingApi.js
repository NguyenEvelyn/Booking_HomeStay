import { apiClient } from './client.js';

export const bookingApi = {
  // Authoritative price: the app never computes the charged amount itself.
  quote: (payload) => apiClient('/bookings/quote', { method: 'POST', body: JSON.stringify(payload) }),
  createVnPayPayment: (payload) => apiClient('/bookings/vnpay', { method: 'POST', body: JSON.stringify(payload) }),
  retryPayment: (id) => apiClient(`/bookings/${id}/retry-payment`, { method: 'POST' }),
  mine: () => apiClient('/bookings/mine'),
  cancellationQuote: (id) => apiClient(`/bookings/${id}/cancellation-quote`),
  cancel: (id, reason) => apiClient(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  announceLateArrival: (id, payload) => apiClient(`/bookings/${id}/late-arrival`, { method: 'POST', body: JSON.stringify(payload) }),
  disputeNoShow: (id, reason) => apiClient(`/bookings/${id}/no-show/dispute`, { method: 'POST', body: JSON.stringify({ reason }) }),
  createReview: (payload) => apiClient('/reviews', { method: 'POST', body: JSON.stringify(payload) })
};
