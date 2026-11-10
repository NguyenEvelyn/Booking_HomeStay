import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Same key as the web app. Native keeps the token in the device keychain/keystore; SecureStore has no
// web implementation, so the browser preview (Expo web) falls back to localStorage.
const KEY = 'tripio-access-token';
const isWeb = Platform.OS === 'web';

export async function getToken() {
  try {
    return isWeb ? window.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token) {
  if (!token) return;
  if (isWeb) window.localStorage.setItem(KEY, token);
  else await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken() {
  try {
    if (isWeb) window.localStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing stored.
  }
}
