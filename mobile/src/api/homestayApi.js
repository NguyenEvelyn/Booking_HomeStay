import { apiClient } from './client.js';

export const homestayApi = {
  list: ({ search = '', location = '', province = '', checkIn = '', checkOut = '', guests = 1, rooms = 1, minRating = 0, sort = '', page = 1, pageSize = 12 } = {}) => {
    const params = new URLSearchParams({ search, location, province, guests, rooms, minRating, sort, page, pageSize });
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    return apiClient(`/homestays?${params}`);
  },
  detail: (id) => apiClient(`/homestays/${id}`)
};
