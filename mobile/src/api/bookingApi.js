import { apiClient } from './client.js';

export const bookingApi = {
  // Authoritative price: the app never computes the charged amount itself.
  quote: (payload) => apiClient('/bookings/quote', { method: 'POST', body: JSON.stringify(payload) }),
  createVnPayPayment: (payload) => apiClient('/bookings/vnpay', { method: 'POST', body: JSON.stringify(payload) }),
  retryPayment: (id) => apiClient(`/bookings/${id}/retry-payment`, { method: 'POST' }),
  mine: () => apiClient('/bookings/mine')
};
