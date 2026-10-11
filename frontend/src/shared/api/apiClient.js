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

const ACCESS_TOKEN_KEY = 'tripio-access-token';

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
    || window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function saveAccessToken(token, remember = false) {
  if (typeof window === 'undefined' || !token) return;
  clearAccessToken();
  const storage = remember ? window.localStorage : window.sessionStorage;
  storage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function apiClient(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const method = String(options.method || 'GET').toUpperCase();
  const accessToken = getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    cache: method === 'GET' ? 'no-store' : undefined,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && typeof window !== 'undefined') {
    clearAccessToken();
    window.dispatchEvent(new CustomEvent('tripio:unauthorized', { detail: { path } }));
  }
  if (!response.ok) throw new Error(data.message || data.title || `Yêu cầu thất bại (HTTP ${response.status}).`);
  return data;
}
