import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNativeApp = () => Capacitor.isNativePlatform();

function applyIncomingUrl(rawUrl) {
  try {
    const incoming = new URL(rawUrl);
    const query = incoming.search || '';
    if (query) window.location.replace(`/${query}`);
  } catch {
    // Ignore malformed external URLs instead of navigating the WebView.
  }
}

export async function initializeNativeShell() {
  if (!isNativeApp()) return () => {};
  document.documentElement.dataset.platform = Capacitor.getPlatform();
  await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  await StatusBar.setBackgroundColor({ color: '#061f4e' }).catch(() => {});
  const urlListener = await App.addListener('appUrlOpen', ({ url }) => applyIncomingUrl(url));
  const backListener = await App.addListener('backButton', ({ canGoBack }) => {
    if (document.querySelector('[role="dialog"],.menu-open,.sidebar-mobile-open')) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      return;
    }
    if (canGoBack || window.history.length > 1) window.history.back();
    else App.minimizeApp();
  });
  const keyboardListener = await Keyboard.addListener('keyboardWillShow', () => document.documentElement.classList.add('native-keyboard-open'));
  const keyboardHideListener = await Keyboard.addListener('keyboardWillHide', () => document.documentElement.classList.remove('native-keyboard-open'));
  return () => [urlListener, backListener, keyboardListener, keyboardHideListener].forEach(listener => listener?.remove());
}
