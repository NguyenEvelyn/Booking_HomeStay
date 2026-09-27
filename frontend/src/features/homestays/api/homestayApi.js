import { apiClient } from '../../../shared/api/apiClient.js';
import { recommendationSessionId } from './recommendationEvents.js';

export const homestayApi = {
  list: ({ search = '', location = '', province = '', checkIn = '', checkOut = '', guests = 1, rooms = 1, maxPrice = '', roomType = '', minRating = 0, sort = '', page = 1, pageSize = 12 } = {}) => {
    const params = new URLSearchParams({ search, location, province, guests, rooms, minRating, sort, page, pageSize });
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (maxPrice !== '') params.set('maxPrice', maxPrice);
    if (roomType) params.set('roomType', roomType);
    return apiClient(`/homestays?${params}`);
  },
  detail: (id) => apiClient(`/homestays/${id}`),
  availability: (id, { checkIn, checkOut, guests, rooms }) => apiClient(`/homestays/${id}/availability?${new URLSearchParams({ checkIn, checkOut, guests, rooms })}`),
  recommendations: ({ search = '', checkIn = '', checkOut = '', guests = 2, rooms = 1, totalBudget = '', amenities = [], roomType = '', minRating = 0, topK = 3 } = {}) => {
    const params = new URLSearchParams({ search, guests, rooms, roomType, minRating, topK, sessionId: recommendationSessionId() });
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (totalBudget) params.set('totalBudget', totalBudget);
    if (amenities.length) params.set('amenities', amenities.join(','));
    return apiClient(`/recommendations?${params}`);
  },
  reviews: (id) => apiClient(`/homestays/${id}/reviews`),
  createReview: (payload) => apiClient('/reviews', { method: 'POST', body: JSON.stringify(payload) }),
  replyReview: (id, reply) => apiClient(`/reviews/${id}/reply`, { method: 'POST', body: JSON.stringify({ reply }) }),
  hostReviews: (filters = {}) => apiClient(`/host/reviews?${new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''&&v!=null))}`),
  hostReviewSummary: (filters = {}) => apiClient(`/host/reviews/summary?${new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''&&v!=null))}`),
  updateReviewReply: (id,reply) => apiClient(`/host/reviews/${id}/reply`, { method: 'PUT', body: JSON.stringify({reply}) }),
  deleteReviewReply: id => apiClient(`/host/reviews/${id}/reply`, { method: 'DELETE' }),
  reportReview: (id,data) => apiClient(`/host/reviews/${id}/report`, { method: 'POST', body: JSON.stringify(data) }),
  hostCustomers: (filters = {}) => apiClient(`/host/customers?${new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''&&v!=null))}`),
  hostCustomerDetail: id => apiClient(`/host/customers/${id}`),
  saveHostCustomerNote: (id,note) => apiClient(`/host/customers/${id}/note`, { method: 'PUT', body: JSON.stringify({note}) }),
  roomTypeDetail: (id) => apiClient(`/room-types/${id}`),
  hostList: () => apiClient('/host/homestays'),
  hostOverview: () => apiClient('/host/homestays/overview'),
  hostBookings: () => apiClient('/host/homestays/bookings'),
  updateBookingStatus: (id,status) => apiClient(`/host/homestays/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({status}) }),
  markBookingViewed: (id) => apiClient(`/host/homestays/bookings/${id}/viewed`, { method: 'PATCH', body: JSON.stringify({}) }),
  updateBookingNote: (id,note) => apiClient(`/host/homestays/bookings/${id}/note`, { method: 'PATCH', body: JSON.stringify({note}) }),
  confirmOfflinePayment: (id,method) => apiClient(`/host/homestays/bookings/${id}/offline-payment`, { method: 'POST', body: JSON.stringify({method}) }),
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
  uploadRoomImages: (id,roomId,files) => { const body=new FormData(); files.forEach(file=>body.append('files',file)); return apiClient(`/host/homestays/${id}/rooms/${roomId}/images/upload`,{method:'POST',body}); },
  deleteRoomImage: (id,roomId,imageId) => apiClient(`/host/homestays/${id}/rooms/${roomId}/images/${imageId}`, { method: 'DELETE' }),
  addPricePeriod: (id,roomTypeId,data) => apiClient(`/host/homestays/${id}/room-types/${roomTypeId}/prices`, { method: 'POST', body: JSON.stringify(data) }),
  deletePricePeriod: (id,roomTypeId,priceId) => apiClient(`/host/homestays/${id}/room-types/${roomTypeId}/prices/${priceId}`, { method: 'DELETE' }),
  submitHomestay: (id) => apiClient(`/host/homestays/${id}/submit`, { method: 'POST' })
};
