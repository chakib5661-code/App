/**
 * PWA Version Manager & Service Worker Registration Helper
 * Safely handles service worker registration, version logging, and updates across browsers and PWA environments.
 */

export const APP_VERSION = '1.1.6';

export function registerPwaServiceWorker(): void {
  if (typeof window === 'undefined') return;

  console.log(`[PWA] Tulip Fragrance Company running version ${APP_VERSION}`);

  // Automatically write over / clear old caches if application version changes
  try {
    const lastVersion = localStorage.getItem('tulip_app_version');
    if (lastVersion && lastVersion !== APP_VERSION) {
      console.log(`[PWA] Version changed from ${lastVersion} to ${APP_VERSION}. Purging old caches...`);
      if ('caches' in window) {
        caches.keys().then((cacheNames) => {
          Promise.all(cacheNames.map((name) => caches.delete(name))).then(() => {
            console.log('[PWA] Stale caches deleted. Overwriting with fresh assets on reload...');
            localStorage.setItem('tulip_app_version', APP_VERSION);
            window.location.reload();
          });
        }).catch(() => {
          localStorage.setItem('tulip_app_version', APP_VERSION);
        });
      } else {
        localStorage.setItem('tulip_app_version', APP_VERSION);
      }
    } else if (!lastVersion) {
      localStorage.setItem('tulip_app_version', APP_VERSION);
    }
  } catch (err) {
    console.warn('[PWA] Version-cache purge warning:', err);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            registration.update().catch(() => {});
          }
        })
        .catch(() => {});
    });
  }
}

export function unregisterPwaServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(false);
  }

  return navigator.serviceWorker.getRegistrations().then((registrations) => {
    const unregisterPromises = registrations.map((r) => r.unregister());
    return Promise.all(unregisterPromises).then(() => true);
  });
}

export default {
  APP_VERSION,
  registerPwaServiceWorker,
  unregisterPwaServiceWorker,
};
