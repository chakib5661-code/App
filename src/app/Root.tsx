'use client';

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import App from "../App";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { initAnalytics } from "../utils/analytics";
import { registerPwaServiceWorker } from "../utils/pwaVersionManager";

export default function Root() {
  useEffect(() => {
    // Initialize Analytics & Tracking Scripts (GA4 & Microsoft Clarity) and PWA version handling
    initAnalytics();
    registerPwaServiceWorker();
  }, []);

  return (
    <ErrorBoundary>
      <App />
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  );
}
