/**
 * Tulip Fragrance Company - Advanced Offline Image Caching & Prefetching
 * Enables PWA to store all product pictures locally in CacheStorage so they
 * remain 100% visible even with no internet connection.
 */

import { Product } from '../types';

export const IMAGE_CACHE_NAME = 'tulip-images-v4';

/**
 * Extract all unique, fetchable image URLs from a list of products
 */
export function extractImageUrls(products: Product[]): string[] {
  const urls = new Set<string>();

  // Include core brand imagery
  urls.add('/tulip-logo.svg');
  urls.add('/tulip-extrait-default.jpg');
  urls.add('/pwa-192x192.png');
  urls.add('/pwa-512x512.png');

  for (const product of products) {
    if (!product) continue;
    const img = product.imageUrl;
    if (img && typeof img === 'string' && img.trim().length > 0) {
      // Exclude oversized base64 data strings as they are stored in IndexedDB directly
      if (!img.startsWith('data:')) {
        urls.add(img.trim());
      }
    }
  }

  return Array.from(urls);
}

/**
 * Prefetches all product images and saves them into CacheStorage
 */
export async function prefetchProductImages(products: Product[]): Promise<{ cached: number; total: number }> {
  if (typeof window === 'undefined') return { cached: 0, total: 0 };

  const urls = extractImageUrls(products);
  if (urls.length === 0) return { cached: 0, total: 0 };

  // 1. Notify active service worker to cache these URLs in the background
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_PRODUCT_IMAGES',
        urls,
      });
    } catch {
      // SW message notice
    }
  }

  // 2. Also cache directly via window.caches for instant reliability
  if ('caches' in window) {
    try {
      const cache = await window.caches.open(IMAGE_CACHE_NAME);
      let newlyCached = 0;

      // Fetch images in batches to prevent browser network congestion
      const batchSize = 4;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(async (url) => {
            try {
              const existing = await cache.match(url);
              if (!existing) {
                // Use no-cors to handle cross-origin images (e.g. Unsplash, CDN)
                const response = await fetch(url, {
                  mode: 'no-cors',
                  cache: 'default',
                  credentials: 'omit',
                });
                if (response && (response.ok || response.type === 'opaque')) {
                  await cache.put(url, response);
                  newlyCached++;
                }
              }
            } catch {
              // Silently ignore unreachable images (e.g. if already offline)
            }
          })
        );
      }

      return { cached: newlyCached, total: urls.length };
    } catch (err) {
      console.warn('[ImageCache] Could not prefetch images to window.caches:', err);
    }
  }

  return { cached: 0, total: urls.length };
}

/**
 * Count total number of items stored in the offline image cache
 */
export async function getCachedImagesCount(): Promise<number> {
  if (typeof window === 'undefined' || !('caches' in window)) return 0;
  try {
    const cache = await window.caches.open(IMAGE_CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * Check if a specific image URL is available offline
 */
export async function isImageCached(url: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window) || !url) return false;
  try {
    const cache = await window.caches.open(IMAGE_CACHE_NAME);
    const match = await cache.match(url);
    return !!match;
  } catch {
    return false;
  }
}
