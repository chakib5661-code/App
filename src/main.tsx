import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initAnalytics } from './utils/analytics.ts';
import { registerPwaServiceWorker } from './utils/pwaVersionManager.ts';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './index.css';

// Initialize Analytics & Tracking Scripts (Google Analytics 4 & Microsoft Clarity from Environment Variables)
initAnalytics();

// Register and log PWA Service Worker version
registerPwaServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  </StrictMode>,
);
