import { apiClient } from '../../../shared/api/apiClient.js';

export const newsApi = {
  list: ({ category = '', page = 1, pageSize = 9 } = {}) =>
    apiClient(`/news?${new URLSearchParams({ ...(category ? { category } : {}), page, pageSize })}`),
  detail: (slug) => apiClient(`/news/${encodeURIComponent(slug)}`)
};
