import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './legacy-features.css';
import App from './app/App.jsx';
import './styles.css';
import './shared/styles/portal.css';
import './features/homestays/pages/host-layout.css';
import './shared/styles/mobile-responsive.css';
import FeedbackProvider from './shared/feedback/FeedbackProvider.jsx';
import { initializeNativeShell } from './shared/mobile/nativeBridge.js';

initializeNativeShell();

createRoot(document.getElementById('root')).render(<StrictMode><FeedbackProvider><App /></FeedbackProvider></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.warn('Không thể đăng ký chế độ PWA:', error);
    });
  });
}
