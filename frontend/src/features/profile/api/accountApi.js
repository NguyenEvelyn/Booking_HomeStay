import { apiClient } from '../../../shared/api/apiClient.js';

export const accountApi = {
  profile: () => apiClient('/account/profile'),
  travelProfile: () => apiClient('/account/travel-profile'),
  saveTravelProfile: (data) => apiClient('/account/travel-profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteTravelDocument: () => apiClient('/account/travel-profile/document', { method: 'DELETE' }),
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
