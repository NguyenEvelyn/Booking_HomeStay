import { apiClient } from '../../../shared/api/apiClient.js';

export const bookingApi = {
  mine: () => apiClient('/bookings/mine'),
  detail: (id) => apiClient(`/bookings/${id}`),
  cancellationQuote: (id) => apiClient(`/bookings/${id}/cancellation-quote`),
  cancel: (id, reason) => apiClient(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  createVnPayPayment: (payload) => apiClient('/bookings/vnpay', {
    method: 'POST', body: JSON.stringify(payload)
  })
};
