import { apiClient } from './client.js';
import { saveToken, clearToken } from './tokenStorage.js';

export const authApi = {
  login: async ({ identifier, password }) => {
    const result = await apiClient('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password, remember: true }) });
    await saveToken(result.accessToken);
    return result;
  },
  register: (body) => apiClient('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  me: () => apiClient('/auth/me'),
  logout: async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } finally {
      await clearToken();
    }
  }
};
