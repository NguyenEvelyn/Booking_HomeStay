import { apiClient, API_URL } from '../../../shared/api/apiClient.js';

export const authApi = {
  register: (body) => apiClient('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => apiClient('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  verifyEmail: (body) => apiClient('/auth/verify-email', { method: 'POST', body: JSON.stringify(body) }),
  resendVerification: (body) => apiClient('/auth/resend-verification', { method: 'POST', body: JSON.stringify(body) }),
  forgotPassword: (body) => apiClient('/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
  resetPassword: (body) => apiClient('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
  changePassword: (body) => apiClient('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => apiClient('/auth/logout', { method: 'POST' }),
  me: () => apiClient('/auth/me'),
  externalLogin: (provider) => { window.location.href = `${API_URL}/auth/external/${provider}`; }
};
