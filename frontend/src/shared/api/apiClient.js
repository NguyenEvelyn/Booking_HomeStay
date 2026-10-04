const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function localApiUrl(value) {
  if (typeof window === 'undefined') return value;
  const pageHost = window.location.hostname;
  if (!['localhost', '127.0.0.1'].includes(pageHost)) return value;

  try {
    const url = new URL(value);
    if (['localhost', '127.0.0.1'].includes(url.hostname)) {
      url.hostname = pageHost;
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    // Keep relative or otherwise valid custom API values unchanged.
  }
  return value;
}

export const API_URL = localApiUrl(configuredApiUrl);

export async function apiClient(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const method = String(options.method || 'GET').toUpperCase();
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    cache: method === 'GET' ? 'no-store' : undefined,
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tripio:unauthorized', { detail: { path } }));
  }
  if (!response.ok) throw new Error(data.message || data.title || `Yêu cầu thất bại (HTTP ${response.status}).`);
  return data;
}
