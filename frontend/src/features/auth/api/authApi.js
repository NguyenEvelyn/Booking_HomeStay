import { apiClient } from '../../../shared/api/apiClient.js';

export const authApi = {
  register: (body) => apiClient('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => apiClient('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => apiClient('/auth/logout', { method: 'POST' }),
  me: () => apiClient('/auth/me')
};
