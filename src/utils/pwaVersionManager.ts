/**
 * PWA Version Manager & Service Worker Registration Helper - DISABLED
 * This helper actively unregisters any existing service workers and clears all browser cache storages
 * to ensure that cache saving is disabled and offline service is turned off.
 */

export const APP_VERSION = '1.1.6';

export function registerPwaServiceWorker(): void {
  if (typeof window === 'undefined') return;

  console.log(`[Cache-Disabled] Purging any legacy caches or service workers...`);

  // Force delete any and all cache storages
  try {
    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        Promise.all(cacheNames.map((name) => caches.delete(name))).then(() => {
          console.log('[Cache-Disabled] Legacy caches cleared successfully.');
        });
      }).catch((err) => {
        console.warn('[Cache-Disabled] Cache clearance failed:', err);
      });
    }
  } catch (err) {
    console.warn('[Cache-Disabled] Cache clearance error:', err);
  }

  // Actively unregister any registered service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          registration.unregister()
            .then((success) => {
              if (success) {
                console.log('[Cache-Disabled] Successfully unregistered legacy service worker.');
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
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
