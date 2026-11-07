import { Product } from '../types';

// Brand / gender / style tags are kept per product code so they survive every
// Excel stock import (the POS file never contains them).
const KEY = 'tulip_product_tags_v1';
export type TagMap = Record<string, { brand?: string; gender?: string; style?: string }>;

const norm = (c: string) => String(c || '').toUpperCase().replace(/\s+/g, '');

export function loadTags(): TagMap {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Merge tags found on the given products into the stored map (never drops entries). */
export function rememberTags(products: Product[]): TagMap {
  const map = loadTags();
  products.forEach((p) => {
    if (!p.code || (!p.brand && !p.gender && !p.style)) return;
    const k = norm(p.code);
    map[k] = {
      brand: p.brand || map[k]?.brand,
      gender: p.gender || map[k]?.gender,
      style: p.style || map[k]?.style,
    };
  });
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
  return map;
}

/** Fill missing brand / gender / style from the stored map. */
export function applyStoredTags(products: Product[]): Product[] {
  const map = loadTags();
  return products.map((p) => {
    const t = map[norm(p.code || '')];
    if (!t) return p;
    return {
      ...p,
      brand: p.brand || (t.brand as any),
      gender: p.gender || (t.gender as any),
      style: p.style || (t.style as any),
    };
  });
}
