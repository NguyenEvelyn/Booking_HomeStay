import { apiClient } from '../../../shared/api/apiClient.js';

export const bookingApi = {
  quote: (payload) => apiClient('/bookings/quote', { method: 'POST', body: JSON.stringify(payload) }),
  mine: () => apiClient('/bookings/mine'),
  detail: (id) => apiClient(`/bookings/${id}`),
  cancellationQuote: (id) => apiClient(`/bookings/${id}/cancellation-quote`),
  cancel: (id, reason) => apiClient(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  retryPayment: (id) => apiClient(`/bookings/${id}/retry-payment`, { method: 'POST' }),
  createVnPayPayment: (payload) => apiClient('/bookings/vnpay', {
    method: 'POST', body: JSON.stringify(payload)
  })
};
