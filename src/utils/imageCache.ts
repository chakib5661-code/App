/**
 * Tulip Fragrance Company - Advanced Offline Image Caching & Prefetching (DISABLED)
 * Caching and prefetching have been disabled.
 */

import { Product } from '../types';

export const IMAGE_CACHE_NAME = 'tulip-images-v4';

export function extractImageUrls(products: Product[]): string[] {
  return [];
}

export async function prefetchProductImages(products: Product[]): Promise<{ cached: number; total: number }> {
  return { cached: 0, total: 0 };
}

export async function getCachedImagesCount(): Promise<number> {
  return 0;
}

export async function isImageCached(url: string): Promise<boolean> {
  return false;
}
