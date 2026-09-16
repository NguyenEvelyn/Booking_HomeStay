import { apiClient } from '../../../shared/api/apiClient.js';

export const homestayApi = {
  list: ({ search = '', province = '', checkIn = '', checkOut = '', guests = 1, maxPrice = '', roomType = '', minRating = 0, sort = '', page = 1, pageSize = 12 } = {}) => {
    const params = new URLSearchParams({ search, province, guests, minRating, sort, page, pageSize });
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (maxPrice !== '') params.set('maxPrice', maxPrice);
    if (roomType) params.set('roomType', roomType);
    return apiClient(`/homestays?${params}`);
  },
  detail: (id) => apiClient(`/homestays/${id}`),
  reviews: (id) => apiClient(`/homestays/${id}/reviews`),
  createReview: (payload) => apiClient('/reviews', { method: 'POST', body: JSON.stringify(payload) }),
  replyReview: (id, reply) => apiClient(`/reviews/${id}/reply`, { method: 'POST', body: JSON.stringify({ reply }) }),
  hostReviews: () => apiClient('/host/reviews'),
  roomTypeDetail: (id) => apiClient(`/room-types/${id}`),
  hostList: () => apiClient('/host/homestays'),
  hostOverview: () => apiClient('/host/homestays/overview'),
  hostBookings: () => apiClient('/host/homestays/bookings'),
  submitHomestay: (id) => apiClient(`/host/homestays/${id}/submit`, { method: 'POST' })
};
