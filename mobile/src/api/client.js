import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getToken, clearToken } from './tokenStorage.js';

// EXPO_PUBLIC_API_URL wins (e.g. the Render backend). Otherwise, during development, reach the backend on
// the same machine that serves the Expo bundle: a phone on Wi-Fi cannot use "localhost".
function resolveApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (Platform.OS === 'web') return `http://${window.location.hostname}:5000/api`;
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${devHost || 'localhost'}:5000/api`;
}

export const API_URL = resolveApiUrl();

let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) { onUnauthorized = handler; }

// Mirrors the web apiClient: JSON in/out, Vietnamese error messages, 20s timeout. Mobile authenticates
// with the Bearer token only (no cookies), which the backend accepts for every endpoint.
export async function apiClient(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const token = await getToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs) || 20000);
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        'X-Requested-With': 'XMLHttpRequest',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      },
      signal: options.signal || controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Máy chủ phản hồi quá lâu. Vui lòng kiểm tra kết nối và thử lại.');
    throw new Error(`Không thể kết nối máy chủ Tripio (${API_URL}). Hãy kiểm tra mạng hoặc địa chỉ API.`);
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    await clearToken();
    onUnauthorized();
  }
  if (!response.ok) {
    const error = new Error(data.message || data.title || `Yêu cầu thất bại (HTTP ${response.status}).`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
