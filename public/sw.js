/**
 * Tulip Fragrance Company - High-Performance PWA & Offline Engine (v4)
 * 
 * Features:
 * - Complete Offline Image Caching: All product pictures & brand assets stored in CacheStorage.
 * - Cache-First image serving with instant fallback to default bottle image if offline.
 * - Background Product Image Prefetching triggered upon catalog sync.
 * - Zero-latency API sync fallback for catalog, prices, and stock offline.
 * - Immediate precached SPA shell delivery.
 */

const STATIC_CACHE_NAME = 'tulip-pwa-v4';
const IMAGE_CACHE_NAME = 'tulip-images-v4';
const API_CACHE_NAME = 'tulip-api-v4';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/tulip-logo.svg',
  '/tulip-extrait-default.jpg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
];

// 1. Install & Precache core shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache notice:', err);
      });
    })
  );
});

// 2. Activate & Clean up obsolete caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (
            key !== STATIC_CACHE_NAME &&
            key !== IMAGE_CACHE_NAME &&
            key !== API_CACHE_NAME
          ) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Background messages: Pre-cache product pictures on demand
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'CACHE_PRODUCT_IMAGES' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        for (const url of event.data.urls) {
          if (!url || typeof url !== 'string' || url.startsWith('data:')) continue;
          try {
            const existing = await cache.match(url);
            if (!existing) {
              const resp = await fetch(url, { mode: 'no-cors' });
              if (resp && (resp.ok || resp.type === 'opaque')) {
                await cache.put(url, resp);
              }
            }
          } catch {
            // Silently ignore unreachable URLs
          }
        }
      })
    );
  }
});

// 4. Fetch router
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g. POST orders, POST telegram)
  if (request.method !== 'GET') {
    return;
  }

  // A. Handle /api/sync with fast 1200ms network timeout -> cached response fallback
  if (url.pathname === '/api/sync') {
    event.respondWith(
      new Promise((resolve) => {
        let hasResolved = false;

        const timer = setTimeout(async () => {
          if (!hasResolved) {
            hasResolved = true;
            const apiCache = await caches.open(API_CACHE_NAME);
            const cached = await apiCache.match(request);
            if (cached) {
              resolve(cached);
            }
          }
        }, 1200);

        fetch(request)
          .then((networkResponse) => {
            clearTimeout(timer);
            if (!hasResolved) {
              hasResolved = true;
              if (networkResponse && networkResponse.ok) {
                const responseClone = networkResponse.clone();
                caches.open(API_CACHE_NAME).then((cache) => cache.put(request, responseClone));
              }
              resolve(networkResponse);
            }
          })
          .catch(async () => {
            clearTimeout(timer);
            if (!hasResolved) {
              hasResolved = true;
              const apiCache = await caches.open(API_CACHE_NAME);
              const cached = await apiCache.match(request);
              if (cached) {
                resolve(cached);
              } else {
                resolve(
                  new Response(
                    JSON.stringify({ status: 'ok', products: [], orders: [], customerApplications: [], customerUsers: [], adBanners: [] }),
                    { headers: { 'Content-Type': 'application/json' } }
                  )
                );
              }
            }
          });
      })
    );
    return;
  }

  // B. Handle Product Pictures & All Images: Cache-First with Network & Default Fallback
  const isImage =
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico|avif)$/i) ||
    url.hostname.includes('unsplash.com') ||
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('imgur.com') ||
    (request.headers.get('accept') && request.headers.get('accept').includes('image/'));

  if (isImage) {
    event.respondWith(
      (async () => {
        const imageCache = await caches.open(IMAGE_CACHE_NAME);
        const staticCache = await caches.open(STATIC_CACHE_NAME);

        // 1. Check Image Cache & Static Cache first
        const cached = (await imageCache.match(request)) || (await staticCache.match(request));
        if (cached) {
          // Serve from cache immediately
          return cached;
        }

        // 2. Fetch from network and save to image cache
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
            imageCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // 3. Offline Fallback: If network fails and image is missing, return precached default bottle
          const fallback =
            (await staticCache.match('/tulip-extrait-default.jpg')) ||
            (await staticCache.match('/tulip-logo.svg'));
          if (fallback) return fallback;
          throw err;
        }
      })()
    );
    return;
  }

  // C. Handle SPA navigation (app reloads or tab switches while offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE_NAME);
          const cached =
            (await cache.match(request)) ||
            (await cache.match('/')) ||
            (await cache.match('/index.html'));
          if (cached) return cached;
          return new Response('<h1>Tulip Fragrance</h1><p>Mode Hors-ligne disponible</p>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // D. Handle Static Assets (JS, CSS, Web Fonts)
  const isStaticAsset =
    url.pathname.match(/\.(js|css|woff|woff2|json)$/i) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          // Background revalidation
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                cache.put(request, networkResponse);
              }
            })
            .catch(() => {});
          return cached;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // E. General Network Fetch with Cache Fallback
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(STATIC_CACHE_NAME);
      return cache.match(request);
    })
  );
});
