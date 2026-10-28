const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1'];
const PRIVATE_LAN_HOST = /^(10\.\d{1,3}|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}$/;

// A localhost API URL only works on the dev machine itself. When the page is opened by a LAN IP
// (a phone or emulator on the same Wi-Fi), point the API at that same machine instead.
function localApiUrl(value) {
  if (typeof window === 'undefined') return value;
  const pageHost = window.location.hostname;
  if (!LOOPBACK_HOSTS.includes(pageHost) && !PRIVATE_LAN_HOST.test(pageHost)) return value;

  try {
    const url = new URL(value);
    if (LOOPBACK_HOSTS.includes(url.hostname)) {
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs) || 20000);
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      cache: method === 'GET' ? 'no-store' : undefined,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        // Required by the backend CSRF guard for cookie-authenticated writes.
        'X-Requested-With': 'XMLHttpRequest',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers
      },
      ...options,
      signal: options.signal || controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Máy chủ phản hồi quá lâu. Vui lòng kiểm tra kết nối và thử lại.');
    throw new Error('Không thể kết nối máy chủ Tripio. Hãy kiểm tra mạng hoặc địa chỉ API.');
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && typeof window !== 'undefined') {
    clearAccessToken();
    window.dispatchEvent(new CustomEvent('tripio:unauthorized', { detail: { path } }));
  }
  if (!response.ok) {
    // Keep the body (e.g. room suggestions on a 409) for callers that need more than the message.
    const error = new Error(data.message || data.title || `Yêu cầu thất bại (HTTP ${response.status}).`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
