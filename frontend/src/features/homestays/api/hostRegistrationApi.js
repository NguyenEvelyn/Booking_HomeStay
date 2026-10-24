import { apiClient } from '../../../shared/api/apiClient.js';

export const hostRegistrationApi = {
  register: (data) =>
    apiClient('/HostRegistration/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  uploadImage: (file) => {
    const body = new FormData();
    body.append('file', file);
    return apiClient('/host-registration/upload', { method: 'POST', body });
  },

  getMyRegistration: () =>
    apiClient('/HostRegistration/my-registration'),
};
