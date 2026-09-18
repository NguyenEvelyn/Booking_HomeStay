export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function apiClient(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.title || `Yêu cầu thất bại (HTTP ${response.status}).`);
  return data;
}
