import { apiClient } from '../../../shared/api/apiClient.js';

export const homestayApi = {
  list: ({ search = '', province = '', checkIn = '', checkOut = '', guests = 1, rooms = 1, maxPrice = '', roomType = '', minRating = 0, sort = '', page = 1, pageSize = 12 } = {}) => {
    const params = new URLSearchParams({ search, province, guests, rooms, minRating, sort, page, pageSize });
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (maxPrice !== '') params.set('maxPrice', maxPrice);
    if (roomType) params.set('roomType', roomType);
    return apiClient(`/homestays?${params}`);
  },
  detail: (id) => apiClient(`/homestays/${id}`),
  availability: (id, { checkIn, checkOut, guests, rooms }) => apiClient(`/homestays/${id}/availability?${new URLSearchParams({ checkIn, checkOut, guests, rooms })}`),
  reviews: (id) => apiClient(`/homestays/${id}/reviews`),
  createReview: (payload) => apiClient('/reviews', { method: 'POST', body: JSON.stringify(payload) }),
  replyReview: (id, reply) => apiClient(`/reviews/${id}/reply`, { method: 'POST', body: JSON.stringify({ reply }) }),
  hostReviews: () => apiClient('/host/reviews'),
  roomTypeDetail: (id) => apiClient(`/room-types/${id}`),
  hostList: () => apiClient('/host/homestays'),
  hostOverview: () => apiClient('/host/homestays/overview'),
  hostBookings: () => apiClient('/host/homestays/bookings'),
  updateBookingStatus: (id,status) => apiClient(`/host/homestays/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({status}) }),
  decideCancellation: (id,approve) => apiClient(`/host/homestays/bookings/${id}/cancellation`, { method: 'PATCH', body: JSON.stringify({approve}) }),
  hostRooms: () => apiClient('/host/homestays/rooms/manage'),
  hostProfile: () => apiClient('/host/profile'),
  updateHostProfile: (data) => apiClient('/host/profile', { method: 'PUT', body: JSON.stringify(data) }),
  uploadHostImage: (file) => { const body=new FormData(); body.append('file',file); return apiClient('/host/profile/upload',{method:'POST',body}); },
  hostAmenities: () => apiClient('/host/homestays/amenities'),
  hostDetail: (id) => apiClient(`/host/homestays/${id}`),
  createHomestay: (data) => apiClient('/host/homestays', { method: 'POST', body: JSON.stringify(data) }),
  updateHomestay: (id,data) => apiClient(`/host/homestays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHomestay: (id) => apiClient(`/host/homestays/${id}`, { method: 'DELETE' }),
  saveAmenities: (id,amenityIds) => apiClient(`/host/homestays/${id}/amenities`, { method: 'PUT', body: JSON.stringify({amenityIds}) }),
  addImage: (id,data) => apiClient(`/host/homestays/${id}/images`, { method: 'POST', body: JSON.stringify(data) }),
  deleteImage: (id,imageId) => apiClient(`/host/homestays/${id}/images/${imageId}`, { method: 'DELETE' }),
  addRoomType: (id,data) => apiClient(`/host/homestays/${id}/room-types`, { method: 'POST', body: JSON.stringify(data) }),
  updateRoomType: (id,roomTypeId,data) => apiClient(`/host/homestays/${id}/room-types/${roomTypeId}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateRoomCapacity: (id,roomTypeId,data) => apiClient(`/host/homestays/${id}/room-types/${roomTypeId}/capacity`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkExtraGuestPolicy: (id,data) => apiClient(`/host/homestays/${id}/room-types/extra-guest-policy`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRoomType: (id,roomTypeId) => apiClient(`/host/homestays/${id}/room-types/${roomTypeId}`, { method: 'DELETE' }),
  addRoom: (id,roomTypeId,data) => apiClient(`/host/homestays/${id}/room-types/${roomTypeId}/rooms`, { method: 'POST', body: JSON.stringify(data) }),
  updateRoom: (id,roomId,data) => apiClient(`/host/homestays/${id}/rooms/${roomId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRoom: (id,roomId) => apiClient(`/host/homestays/${id}/rooms/${roomId}`, { method: 'DELETE' }),
  addRoomImage: (id,roomId,data) => apiClient(`/host/homestays/${id}/rooms/${roomId}/images`, { method: 'POST', body: JSON.stringify(data) }),
  deleteRoomImage: (id,roomId,imageId) => apiClient(`/host/homestays/${id}/rooms/${roomId}/images/${imageId}`, { method: 'DELETE' }),
  addPricePeriod: (id,roomTypeId,data) => apiClient(`/host/homestays/${id}/room-types/${roomTypeId}/prices`, { method: 'POST', body: JSON.stringify(data) }),
  deletePricePeriod: (id,roomTypeId,priceId) => apiClient(`/host/homestays/${id}/room-types/${roomTypeId}/prices/${priceId}`, { method: 'DELETE' }),
  submitHomestay: (id) => apiClient(`/host/homestays/${id}/submit`, { method: 'POST' })
};
