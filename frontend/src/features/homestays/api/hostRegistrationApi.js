import { apiClient } from '../../../shared/api/apiClient.js';

export const hostRegistrationApi = {
  register: (data) =>
    apiClient('/HostRegistration/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyRegistration: () =>
    apiClient('/HostRegistration/my-registration'),
};
