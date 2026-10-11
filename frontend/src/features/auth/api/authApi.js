import {
  apiClient,
  API_URL,
  clearAccessToken,
  saveAccessToken
} from '../../../shared/api/apiClient.js';

export const authApi = {
  register: (body) => apiClient('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: async (body) => {
    const result = await apiClient('/auth/login', { method: 'POST', body: JSON.stringify(body) });
    saveAccessToken(result.accessToken, Boolean(body.remember));
    return result;
  },
  verifyEmail: (body) => apiClient('/auth/verify-email', { method: 'POST', body: JSON.stringify(body) }),
  resendVerification: (body) => apiClient('/auth/resend-verification', { method: 'POST', body: JSON.stringify(body) }),
  forgotPassword: (body) => apiClient('/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
  resetPassword: (body) => apiClient('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
  changePassword: async (body) => {
    const result = await apiClient('/auth/change-password', { method: 'POST', body: JSON.stringify(body) });
    clearAccessToken();
    return result;
  },
  logout: async () => {
    try {
      return await apiClient('/auth/logout', { method: 'POST' });
    } finally {
      clearAccessToken();
    }
  },
  me: () => apiClient('/auth/me'),
  externalLogin: (provider) => { window.location.href = `${API_URL}/auth/external/${provider}`; }
};
