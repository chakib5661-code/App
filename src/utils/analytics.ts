import { AnalyticsSettings, CustomAnalyticsEvent, SearchQueryLog } from '../types';

export const ANALYTICS_STORAGE_KEYS = {
  SETTINGS: 'tulip_analytics_settings_v1',
  EVENTS: 'tulip_analytics_events_v1',
  SEARCH_LOGS: 'tulip_analytics_search_logs_v1',
};

export const DEFAULT_ANALYTICS_SETTINGS: AnalyticsSettings = {
  ga4Enabled: false,
  ga4MeasurementId: '',
  customEventsEnabled: true,
  heatmapsEnabled: false,
  heatmapProvider: 'clarity',
  heatmapProjectId: '',
  siteSearchTrackingEnabled: true,
  metaPixelEnabled: false,
  metaPixelId: '',
  tiktokPixelEnabled: false,
  tiktokPixelId: '',
};

// Global declarations for Window object
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    clarity?: (...args: any[]) => void;
    hj?: (...args: any[]) => void;
    _hjSettings?: { hjid: number; hjsv: number };
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    ttq?: {
      load: (id: string) => void;
      page: () => void;
      track: (event: string, params?: any) => void;
      identify?: (params: any) => void;
      [key: string]: any;
    };
    TiktokAnalyticsObject?: string;
    __TULIP_ENV__?: {
      VITE_GA_MEASUREMENT_ID?: string;
      GA_MEASUREMENT_ID?: string;
      VITE_CLARITY_PROJECT_ID?: string;
      CLARITY_PROJECT_ID?: string;
      [key: string]: any;
    };
  }
}

// 0. Extract Environment Variables for GA4 and Microsoft Clarity
export function getEnvAnalyticsConfig(): { gaMeasurementId: string; clarityProjectId: string } {
  let ga = '';
  let clarity = '';

  // Priority 1: Window object injected at runtime by server (e.g. Docker, Cloud Run, SSR)
  if (typeof window !== 'undefined' && window.__TULIP_ENV__) {
    const envObj = window.__TULIP_ENV__;
    if (envObj.VITE_GA_MEASUREMENT_ID) ga = String(envObj.VITE_GA_MEASUREMENT_ID).trim();
    else if (envObj.GA_MEASUREMENT_ID) ga = String(envObj.GA_MEASUREMENT_ID).trim();

    if (envObj.VITE_CLARITY_PROJECT_ID) clarity = String(envObj.VITE_CLARITY_PROJECT_ID).trim();
    else if (envObj.CLARITY_PROJECT_ID) clarity = String(envObj.CLARITY_PROJECT_ID).trim();
  }

  // Priority 2: Vite import.meta.env (client-side build or dev server)
  if (!ga && typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
      ga = String(import.meta.env.VITE_GA_MEASUREMENT_ID).trim();
    } else if ((import.meta.env as any).GA_MEASUREMENT_ID) {
      ga = String((import.meta.env as any).GA_MEASUREMENT_ID).trim();
    }
  }

  if (!clarity && typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_CLARITY_PROJECT_ID) {
      clarity = String(import.meta.env.VITE_CLARITY_PROJECT_ID).trim();
    } else if ((import.meta.env as any).CLARITY_PROJECT_ID) {
      clarity = String((import.meta.env as any).CLARITY_PROJECT_ID).trim();
    }
  }

  // Priority 3: Fallback process.env if available
  if (!ga && typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_GA_MEASUREMENT_ID) ga = String(process.env.VITE_GA_MEASUREMENT_ID).trim();
    else if (process.env.GA_MEASUREMENT_ID) ga = String(process.env.GA_MEASUREMENT_ID).trim();
  }

  if (!clarity && typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_CLARITY_PROJECT_ID) clarity = String(process.env.VITE_CLARITY_PROJECT_ID).trim();
    else if (process.env.CLARITY_PROJECT_ID) clarity = String(process.env.CLARITY_PROJECT_ID).trim();
  }

  return { gaMeasurementId: ga, clarityProjectId: clarity };
}

// 1. Get Settings (with Environment Variables as default & fallback)
export function getAnalyticsSettings(): AnalyticsSettings {
  const envConfig = getEnvAnalyticsConfig();
  const defaultWithEnv: AnalyticsSettings = {
    ...DEFAULT_ANALYTICS_SETTINGS,
    ga4Enabled: Boolean(envConfig.gaMeasurementId),
    ga4MeasurementId: envConfig.gaMeasurementId,
    heatmapsEnabled: Boolean(envConfig.clarityProjectId),
    heatmapProvider: 'clarity',
    heatmapProjectId: envConfig.clarityProjectId,
  };

  try {
    const saved = localStorage.getItem(ANALYTICS_STORAGE_KEYS.SETTINGS);
    if (saved) {
      const parsed: Partial<AnalyticsSettings> = JSON.parse(saved);
      const effectiveGaId = parsed.ga4MeasurementId?.trim() || envConfig.gaMeasurementId;
      const effectiveClarityId = parsed.heatmapProjectId?.trim() || envConfig.clarityProjectId;

      return {
        ...defaultWithEnv,
        ...parsed,
        ga4MeasurementId: effectiveGaId,
        ga4Enabled: effectiveGaId ? (parsed.ga4Enabled ?? true) : false,
        heatmapProjectId: effectiveClarityId,
        heatmapsEnabled: effectiveClarityId ? (parsed.heatmapsEnabled ?? true) : false,
        heatmapProvider: (parsed.heatmapProvider as any) || (effectiveClarityId ? 'clarity' : 'clarity'),
      };
    }
  } catch (e) {
    console.error('Error reading analytics settings:', e);
  }
  return defaultWithEnv;
}

// 2. Save Settings
export function saveAnalyticsSettings(settings: AnalyticsSettings): void {
  try {
    localStorage.setItem(ANALYTICS_STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    syncThirdPartyScripts(settings);
  } catch (e) {
    console.error('Error saving analytics settings:', e);
  }
}

// 3. Script Injections (GA4 & Heatmaps)
export function syncThirdPartyScripts(settings: AnalyticsSettings = getAnalyticsSettings()): void {
  if (typeof window === 'undefined') return;

  // Sync GA4 (Google Analytics 4)
  const rawGaId = settings.ga4MeasurementId?.trim();
  if (settings.ga4Enabled && rawGaId) {
    const mid = rawGaId.toUpperCase();
    if (!document.getElementById('ga4-script')) {
      const script = document.createElement('script');
      script.id = 'ga4-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${mid}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', mid, {
        send_page_view: true,
      });
      console.log(`[Analytics] Google Analytics 4 (GA4) initialisé avec l'ID: ${mid}`);
    }
  }

  // Sync Heatmaps (Microsoft Clarity or Hotjar)
  const rawHeatmapId = settings.heatmapProjectId?.trim();
  if (settings.heatmapsEnabled && rawHeatmapId) {
    const pid = rawHeatmapId;
    if (settings.heatmapProvider === 'clarity' && !document.getElementById('clarity-script')) {
      const script = document.createElement('script');
      script.id = 'clarity-script';
      script.type = 'text/javascript';
      script.innerHTML = `
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${pid}");
      `;
      document.head.appendChild(script);
      console.log(`[Analytics] Microsoft Clarity initialisé avec Project ID: ${pid}`);
    } else if (settings.heatmapProvider === 'hotjar' && !document.getElementById('hotjar-script')) {
      const script = document.createElement('script');
      script.id = 'hotjar-script';
      script.type = 'text/javascript';
      script.innerHTML = `
        (function(h,o,t,j,a,r){
          h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
          h._hjSettings={hjid:${parseInt(pid, 10) || 0},hjsv:6};
          a=o.getElementsByTagName('head')[0];
          r=o.createElement('script');r.async=1;
          r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
          a.appendChild(r);
        })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
      `;
      document.head.appendChild(script);
      console.log(`[Analytics] Hotjar initialisé avec Site ID: ${pid}`);
    }
  }

  // Sync Meta / Facebook Pixel
  if (settings.metaPixelEnabled && settings.metaPixelId?.trim()) {
    const fbid = settings.metaPixelId.trim();
    if (!document.getElementById('meta-pixel-script')) {
      const script = document.createElement('script');
      script.id = 'meta-pixel-script';
      script.type = 'text/javascript';
      script.innerHTML = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${fbid}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(script);
      console.log(`[Analytics] Meta Pixel initialized with ID: ${fbid}`);
    }
  }

  // Sync TikTok Pixel
  if (settings.tiktokPixelEnabled && settings.tiktokPixelId?.trim()) {
    const tid = settings.tiktokPixelId.trim();
    if (!document.getElementById('tiktok-pixel-script')) {
      const script = document.createElement('script');
      script.id = 'tiktok-pixel-script';
      script.type = 'text/javascript';
      script.innerHTML = `
        !function (w, d, t) {
          w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
          var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
          ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
          ttq.load('${tid}');
          ttq.page();
        }(window, document, 'ttq');
      `;
      document.head.appendChild(script);
      console.log(`[Analytics] TikTok Pixel initialized with ID: ${tid}`);
    }
  }
}

// 4. Custom Event Dispatcher
export function trackCustomEvent(
  eventName: string,
  category: CustomAnalyticsEvent['category'],
  label?: string,
  value?: number,
  metadata?: Record<string, any>
): void {
  const settings = getAnalyticsSettings();
  if (!settings.customEventsEnabled) return;

  const event: CustomAnalyticsEvent = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    eventName,
    category,
    label,
    value,
    metadata,
    timestamp: new Date().toISOString(),
  };

  // Dispatch to GA4 if enabled
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, {
        event_category: category,
        event_label: label,
        value: value,
        ...metadata,
      });
    }
  } catch (err) {
    console.warn('[Analytics] GA4 dispatch failed:', err);
  }

  // Dispatch to Meta / Facebook Pixel if initialized
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      if (eventName.includes('cart') || eventName.includes('add')) {
        window.fbq('track', 'AddToCart', { content_name: label, value: value || 0, currency: 'DZD' });
      } else if (eventName.includes('checkout') || eventName.includes('preorder_init')) {
        window.fbq('track', 'InitiateCheckout', { value: value || 0, currency: 'DZD' });
      } else if (eventName.includes('order_submit') || eventName.includes('purchase')) {
        window.fbq('track', 'Purchase', { value: value || 0, currency: 'DZD' });
      } else if (eventName.includes('view') || eventName.includes('detail')) {
        window.fbq('track', 'ViewContent', { content_name: label, value: value || 0, currency: 'DZD' });
      } else {
        window.fbq('trackCustom', eventName, { label, value, ...metadata });
      }
    }
  } catch (err) {
    console.warn('[Analytics] Meta Pixel dispatch failed:', err);
  }

  // Dispatch to TikTok Pixel if initialized
  try {
    if (typeof window !== 'undefined' && window.ttq && typeof window.ttq.track === 'function') {
      if (eventName.includes('cart') || eventName.includes('add')) {
        window.ttq.track('AddToCart', { content_name: label, value: value || 0, currency: 'DZD' });
      } else if (eventName.includes('checkout') || eventName.includes('preorder_init')) {
        window.ttq.track('InitiateCheckout', { value: value || 0, currency: 'DZD' });
      } else if (eventName.includes('order_submit') || eventName.includes('purchase')) {
        window.ttq.track('PlaceAnOrder', { value: value || 0, currency: 'DZD' });
      } else if (eventName.includes('view') || eventName.includes('detail')) {
        window.ttq.track('ViewContent', { content_name: label, value: value || 0, currency: 'DZD' });
      } else {
        window.ttq.track(eventName, { label, value, ...metadata });
      }
    }
  } catch (err) {
    console.warn('[Analytics] TikTok Pixel dispatch failed:', err);
  }

  // Store in LocalStorage (keep max 400 events)
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEYS.EVENTS);
    const list: CustomAnalyticsEvent[] = raw ? JSON.parse(raw) : [];
    const updated = [event, ...list].slice(0, 400);
    localStorage.setItem(ANALYTICS_STORAGE_KEYS.EVENTS, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving custom event:', e);
  }
}

// 5. Site Search Analytics Tracker
export function trackSearchQuery(
  query: string,
  resultsCount: number,
  filterFamily?: string
): void {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery || cleanQuery.length < 2) return;

  const settings = getAnalyticsSettings();
  if (!settings.siteSearchTrackingEnabled) return;

  const searchLog: SearchQueryLog = {
    id: `search-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    query: cleanQuery,
    resultsCount,
    filterFamily,
    timestamp: new Date().toISOString(),
  };

  // Dispatch to GA4
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'search', {
        search_term: cleanQuery,
        results_count: resultsCount,
        category: filterFamily || 'all',
      });
    }
  } catch (err) {
    console.warn('[Analytics] GA4 search tracking failed:', err);
  }

  // Save in LocalStorage (keep max 300 search logs)
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEYS.SEARCH_LOGS);
    const list: SearchQueryLog[] = raw ? JSON.parse(raw) : [];
    const updated = [searchLog, ...list].slice(0, 300);
    localStorage.setItem(ANALYTICS_STORAGE_KEYS.SEARCH_LOGS, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving search log:', e);
  }
}

// 6. Retrieve Event Logs & Search Logs
export function getStoredEvents(): CustomAnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEYS.EVENTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return [];
}

export function getStoredSearchLogs(): SearchQueryLog[] {
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEYS.SEARCH_LOGS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return [];
}

export function clearAnalyticsData(): void {
  try {
    localStorage.removeItem(ANALYTICS_STORAGE_KEYS.EVENTS);
    localStorage.removeItem(ANALYTICS_STORAGE_KEYS.SEARCH_LOGS);
  } catch (e) {
    console.error(e);
  }
}

// 7. Initialize Analytics at Application Boot
export function initAnalytics(): void {
  if (typeof window === 'undefined') return;

  // Immediately synchronize scripts from env or cached settings
  try {
    const current = getAnalyticsSettings();
    syncThirdPartyScripts(current);
  } catch (e) {
    console.warn('[Analytics] Initialization notice:', e);
  }

  // Fetch runtime configuration from server (/api/analytics-config) if available
  fetch('/api/analytics-config')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && (data.gaMeasurementId || data.clarityProjectId)) {
        applyServerAnalyticsConfig({
          gaMeasurementId: data.gaMeasurementId,
          clarityProjectId: data.clarityProjectId,
        });
      }
    })
    .catch(() => {});
}

// 8. Dynamically apply runtime configuration from server
export function applyServerAnalyticsConfig(config: {
  gaMeasurementId?: string;
  clarityProjectId?: string;
}): void {
  if (typeof window === 'undefined' || !config) return;

  const currentEnv = window.__TULIP_ENV__ || {};
  let changed = false;

  if (config.gaMeasurementId && config.gaMeasurementId !== currentEnv.VITE_GA_MEASUREMENT_ID) {
    currentEnv.VITE_GA_MEASUREMENT_ID = config.gaMeasurementId;
    changed = true;
  }
  if (config.clarityProjectId && config.clarityProjectId !== currentEnv.VITE_CLARITY_PROJECT_ID) {
    currentEnv.VITE_CLARITY_PROJECT_ID = config.clarityProjectId;
    changed = true;
  }

  if (changed) {
    window.__TULIP_ENV__ = currentEnv;
    syncThirdPartyScripts(getAnalyticsSettings());
  }
}

