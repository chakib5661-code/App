import { Product } from '../types';

/** Hard cap for a clearance discount so a typo (99 %) cannot give products away. */
export const MAX_CLEARANCE_PERCENT = 90;

export type ExistingDiscountMode = 'raise' | 'replace' | 'keep';

const norm = (code?: string) => String(code || '').toUpperCase().replace(/\s+/g, '');

/** Splits pasted text (commas, spaces, new lines) into unique upper-case codes. */
export function parseCodes(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const c = norm(raw);
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

/** Matches codes to site products by code. Codes with no product are returned in `notFound`. */
export function matchCodes(products: Product[], codes: string[]): { matched: Product[]; notFound: string[] } {
  const byCode = new Map<string, Product[]>();
  for (const p of products) {
    const k = norm(p.code);
    if (!k) continue;
    byCode.set(k, [...(byCode.get(k) || []), p]);
  }
  const matched: Product[] = [];
  const notFound: string[] = [];
  const used = new Set<string>();
  for (const c of codes) {
    const list = byCode.get(c);
    if (!list) {
      notFound.push(c);
      continue;
    }
    for (const p of list) {
      if (!used.has(p.id)) {
        used.add(p.id);
        matched.push(p);
      }
    }
  }
  return { matched, notFound };
}

export function clampPercent(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(MAX_CLEARANCE_PERCENT, Math.round(v * 100) / 100);
}

/** Discount a product ends up with, given what it has now and what is asked. */
export function resolveDiscount(current: number | undefined, wanted: number, mode: ExistingDiscountMode): number {
  const cur = current || 0;
  const w = clampPercent(wanted);
  if (mode === 'keep') return cur > 0 ? cur : w;
  if (mode === 'raise') return Math.max(cur, w);
  return w;
}

export interface ClearanceLine {
  id: string;
  percent: number;
  group: 'dead' | 'slow' | 'other';
}

/** Applies a batch. Remembers the previous discount so it can be restored. */
export function applyClearance(
  products: Product[],
  lines: ClearanceLine[],
  opts: { batch: string; until?: string; now?: Date }
): Product[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const startedAt = (opts.now || new Date()).toISOString();
  return products.map((p) => {
    const l = byId.get(p.id);
    if (!l) return p;
    // A product already in a clearance keeps its original prevDiscount.
    const prev = p.clearance ? p.clearance.prevDiscount : p.discountPercent || 0;
    return {
      ...p,
      discountPercent: l.percent > 0 ? l.percent : undefined,
      clearance: { batch: opts.batch, startedAt, until: opts.until, prevDiscount: prev || undefined, group: l.group },
      lastUpdated: startedAt,
    };
  });
}

/** Ends clearance for one batch, or all when `batch` is omitted. Restores the earlier discount. */
export function removeClearance(products: Product[], batch?: string): Product[] {
  const now = new Date().toISOString();
  return products.map((p) => {
    if (!p.clearance || (batch && p.clearance.batch !== batch)) return p;
    const { clearance, ...rest } = p;
    return { ...rest, discountPercent: clearance.prevDiscount || undefined, lastUpdated: now };
  });
}

/** True when the clearance end date has passed (end date counts through the end of that day). */
export function isExpired(p: Product, now: Date = new Date()): boolean {
  const u = p.clearance?.until;
  if (!u) return false;
  const end = new Date(u.length <= 10 ? `${u}T23:59:59` : u);
  return !Number.isNaN(end.getTime()) && end.getTime() < now.getTime();
}

/** Mutates the list in place: ends expired clearances. Returns true when something changed. */
export function expireClearances(products: Product[], now: Date = new Date()): boolean {
  let changed = false;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    if (p.clearance && isExpired(p, now)) {
      const { clearance, ...rest } = p;
      products[i] = { ...rest, discountPercent: clearance.prevDiscount || undefined, lastUpdated: now.toISOString() };
      changed = true;
    }
  }
  return changed;
}

export function batchSummary(products: Product[]): { batch: string; count: number; until?: string; startedAt: string }[] {
  const map = new Map<string, { batch: string; count: number; until?: string; startedAt: string }>();
  for (const p of products) {
    const c = p.clearance;
    if (!c) continue;
    const cur = map.get(c.batch);
    if (cur) cur.count += 1;
    else map.set(c.batch, { batch: c.batch, count: 1, until: c.until, startedAt: c.startedAt });
  }
  return [...map.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
