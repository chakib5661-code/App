import { Product } from '../types';

/**
 * Determines whether a product qualifies as a Top Seller (Meilleure Vente).
 * Products with high stock or marked explicitly as top sellers are flagged.
 */
export function isProductTopSeller(product: Product): boolean {
  if (product.isTopSeller === true) return true;
  if (product.isTopSeller === false) return false;

  // Extrait: stock in grams (high stock >= 1500g)
  if (product.family === 'Extrait') {
    return product.stock >= 1500;
  }

  // Flacon: stock in bottle units (high stock >= 100 units)
  if (product.family === 'Flacon') {
    return product.stock >= 100;
  }

  // Accessoire: stock in accessory units (high stock >= 50 units)
  if (product.family === 'Accessoire') {
    return product.stock >= 50;
  }

  return product.stock >= 500;
}

/**
 * Safely calculates a discounted price keeping up to 2 decimal places (decimal 10,2).
 */
export function calculateDiscountedPrice(price: number, discountPercent?: number): number {
  if (!price) return 0;
  if (!discountPercent || discountPercent <= 0) {
    return Math.round(price * 100) / 100;
  }
  const discounted = price * (1 - discountPercent / 100);
  return Math.round(discounted * 100) / 100;
}

export type GenderKey = 'men' | 'women' | 'unisex';

/** Maps free-text gender values (FR/EN/AR) to one of three filter keys; null when unknown. */
export function normalizeGender(raw?: string | null): GenderKey | null {
  const g = (raw || '').trim().toLowerCase();
  if (!g) return null;
  if (/(unisex|mixte|uni\b|مختلط|للجنسين)/.test(g)) return 'unisex';
  if (/(women|woman|femme|female|pour elle|لها|نساء|نسائي)/.test(g)) return 'women';
  if (/(men|man|homme|male|pour lui|له|رجال|رجالي)/.test(g)) return 'men';
  return null;
}
