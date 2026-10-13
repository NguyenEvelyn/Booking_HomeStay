import { apiClient } from '../../../shared/api/apiClient.js';

export const accountApi = {
  profile: () => apiClient('/account/profile'),
  updateProfile: (data) => apiClient('/account/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  uploadAvatar: (file) => {
    const body = new FormData();
    body.append('file', file);
    return apiClient('/account/avatar', { method: 'POST', body });
  },
};
