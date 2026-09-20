import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './legacy-features.css';
import App from './app/App.jsx';
import './styles.css';
import './shared/styles/portal.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
