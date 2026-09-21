import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './legacy-features.css';
import App from './app/App.jsx';
import './styles.css';
import './shared/styles/portal.css';
import FeedbackProvider from './shared/feedback/FeedbackProvider.jsx';

createRoot(document.getElementById('root')).render(<StrictMode><FeedbackProvider><App /></FeedbackProvider></StrictMode>);
