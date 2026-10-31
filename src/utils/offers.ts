import type { Bundle, CartItem, LoyaltyTier, OffersConfig, Product, RewardTier, VolumeDefaultRule, VolumeTier } from '../types';
import { calculateDiscountedPrice } from './productUtils';

/**
 * Offers engine. Pure functions shared by the storefront (display) and the server (authoritative
 * price check when an order is created), so both always compute the same totals.
 */

export const DEFAULT_OFFERS: OffersConfig = {
  minOrderAmountDA: 1000,
  rewardLadder: {
    enabled: true,
    tiers: [
      { id: 'tier-delivery', thresholdDA: 20000, type: 'free_delivery', label: 'Livraison à domicile offerte' },
      { id: 'tier-percent', thresholdDA: 40000, type: 'percent', value: 3, label: '3% de remise sur la commande' },
    ],
  },
  volumePricing: {
    enabled: true,
    adviceFromPercent: 60,
    defaults: [
      { family: 'Extrait', minQty: 500, offDA: 0.5 },
      { family: 'Extrait', minQty: 1000, offDA: 1 },
      { family: 'Flacon', minQty: 120, offDA: 5 },
    ],
  },
  crossSell: { enabled: true, maxSuggestions: 3 },
  bundles: { enabled: true, items: [] },
  socialProof: { enabled: true, windowDays: 30, minCustomers: 3 },
  reorder: { enabled: true },
  addToOrder: { enabled: true, windowHours: 2, pushEnabled: true },
  loyalty: {
    enabled: true,
    windowDays: 90,
    tiers: [
      { id: 'loyal-silver', name: 'Argent', minSpendDA: 100000, discountPercent: 2, perk: 'Remise de 2% sur chaque commande' },
      { id: 'loyal-gold', name: 'Or', minSpendDA: 300000, discountPercent: 4, perk: 'Remise de 4% et préparation prioritaire' },
    ],
  },
  reminders: { enabled: true, abandonedCartAfterHours: 3, reorderAfterDays: 30 },
  notifications: {
    enabled: true,
    orderStatus: true,
    abandonedCart: true,
    reorder: true,
    loyaltyLevelUp: true,
    maxPerWeek: 3,
    minHoursBetween: 48,
    sendFromHour: 9,
    sendToHour: 19,
  },
};

/** Merge a stored (possibly partial or older) config over the defaults. */
export function normalizeOffers(raw: Partial<OffersConfig> | null | undefined, legacyMinOrder?: number): OffersConfig {
  const d = DEFAULT_OFFERS;
  const r: any = raw || {};
  const num = (v: any, f: number) => (Number.isFinite(Number(v)) ? Number(v) : f);
  return {
    minOrderAmountDA: Math.max(0, num(r.minOrderAmountDA, legacyMinOrder ?? d.minOrderAmountDA)),
    rewardLadder: {
      enabled: Boolean(r.rewardLadder?.enabled ?? d.rewardLadder.enabled),
      tiers: Array.isArray(r.rewardLadder?.tiers) ? r.rewardLadder.tiers : d.rewardLadder.tiers,
    },
    volumePricing: {
      enabled: Boolean(r.volumePricing?.enabled ?? d.volumePricing.enabled),
      defaults: Array.isArray(r.volumePricing?.defaults)
        ? (r.volumePricing.defaults as VolumeDefaultRule[]).filter((x) => x && x.minQty > 0 && x.offDA >= 0)
        : d.volumePricing.defaults,
      adviceFromPercent: Math.min(100, Math.max(1, num(r.volumePricing?.adviceFromPercent, d.volumePricing.adviceFromPercent))),
    },
    crossSell: {
      enabled: Boolean(r.crossSell?.enabled ?? d.crossSell.enabled),
      maxSuggestions: Math.min(6, Math.max(1, num(r.crossSell?.maxSuggestions, d.crossSell.maxSuggestions))),
    },
    bundles: {
      enabled: Boolean(r.bundles?.enabled ?? d.bundles.enabled),
      items: Array.isArray(r.bundles?.items) ? r.bundles.items : [],
    },
    socialProof: {
      enabled: Boolean(r.socialProof?.enabled ?? d.socialProof.enabled),
      windowDays: Math.max(1, num(r.socialProof?.windowDays, d.socialProof.windowDays)),
      minCustomers: Math.max(1, num(r.socialProof?.minCustomers, d.socialProof.minCustomers)),
    },
    reorder: { enabled: Boolean(r.reorder?.enabled ?? d.reorder.enabled) },
    addToOrder: {
      enabled: Boolean(r.addToOrder?.enabled ?? d.addToOrder.enabled),
      windowHours: Math.max(0, num(r.addToOrder?.windowHours, d.addToOrder.windowHours)),
      pushEnabled: Boolean(r.addToOrder?.pushEnabled ?? d.addToOrder.pushEnabled),
    },
    loyalty: {
      enabled: Boolean(r.loyalty?.enabled ?? d.loyalty.enabled),
      windowDays: Math.max(1, num(r.loyalty?.windowDays, d.loyalty.windowDays)),
      tiers: Array.isArray(r.loyalty?.tiers) ? r.loyalty.tiers : d.loyalty.tiers,
    },
    reminders: {
      enabled: Boolean(r.reminders?.enabled ?? d.reminders.enabled),
      abandonedCartAfterHours: Math.max(1, num(r.reminders?.abandonedCartAfterHours, d.reminders.abandonedCartAfterHours)),
      reorderAfterDays: Math.max(1, num(r.reminders?.reorderAfterDays, d.reminders.reorderAfterDays)),
    },
    notifications: {
      enabled: Boolean(r.notifications?.enabled ?? d.notifications.enabled),
      orderStatus: Boolean(r.notifications?.orderStatus ?? d.notifications.orderStatus),
      abandonedCart: Boolean(r.notifications?.abandonedCart ?? d.notifications.abandonedCart),
      reorder: Boolean(r.notifications?.reorder ?? d.notifications.reorder),
      loyaltyLevelUp: Boolean(r.notifications?.loyaltyLevelUp ?? d.notifications.loyaltyLevelUp),
      maxPerWeek: Math.max(0, num(r.notifications?.maxPerWeek, d.notifications.maxPerWeek)),
      minHoursBetween: Math.max(0, num(r.notifications?.minHoursBetween, d.notifications.minHoursBetween)),
      sendFromHour: Math.min(23, Math.max(0, num(r.notifications?.sendFromHour, d.notifications.sendFromHour))),
      sendToHour: Math.min(24, Math.max(1, num(r.notifications?.sendToHour, d.notifications.sendToHour))),
    },
    updatedAt: r.updatedAt,
  };
}

// ---------- volume prices ----------

/**
 * Tiers that apply to a product: its own tierPrices when set, otherwise the family defaults
 * from the admin (price = list price minus offDA per unit).
 */
export function effectiveTiers(product: Product, offers?: OffersConfig | null): VolumeTier[] {
  const own = (product.tierPrices || []).filter((t) => t && t.minQty > 0 && t.priceDA > 0);
  if (own.length > 0) return own.slice().sort((a, b) => a.minQty - b.minQty);
  if (!offers || !offers.volumePricing.enabled) return [];
  return offers.volumePricing.defaults
    .filter((r) => r.family === product.family && r.minQty > 0 && r.offDA > 0 && product.priceDA - r.offDA > 0)
    .map((r) => ({ minQty: r.minQty, priceDA: Math.round((product.priceDA - r.offDA) * 100) / 100 }))
    .sort((a, b) => a.minQty - b.minQty);
}

/** Best tier reached for a quantity, and the next one still to reach. */
export function resolveVolumeTier(
  product: Product,
  quantity: number,
  offers: OffersConfig | null | undefined
): { applied?: VolumeTier; next?: VolumeTier } {
  if (!offers || !offers.volumePricing.enabled) return {};
  let applied: VolumeTier | undefined;
  let next: VolumeTier | undefined;
  for (const t of effectiveTiers(product, offers)) {
    if (quantity >= t.minQty) applied = t;
    else if (!next) next = t;
  }
  return { applied, next };
}

/**
 * Advice to raise the quantity: when the quantity is within reach of the next volume price
 * (at least adviceFromPercent % of it), say how much more to add and what it saves.
 */
export function volumeNudge(
  product: Product,
  quantity: number,
  offers: OffersConfig | null | undefined
): { minQty: number; missing: number; currentUnit: number; nextUnit: number; savingDA: number } | null {
  if (!offers || !offers.volumePricing.enabled || quantity <= 0) return null;
  const { next } = resolveVolumeTier(product, quantity, offers);
  if (!next) return null;
  if (quantity < (next.minQty * offers.volumePricing.adviceFromPercent) / 100) return null;
  const currentUnit = getUnitPrice(product, quantity, offers);
  const nextUnit = getUnitPrice(product, next.minQty, offers);
  const savingDA = Math.round((currentUnit - nextUnit) * next.minQty * 100) / 100;
  if (savingDA <= 0) return null;
  return { minQty: next.minQty, missing: next.minQty - quantity, currentUnit, nextUnit, savingDA };
}

/** Unit price after volume tier (replaces the list price) and the product's own discount percent. */
export function getUnitPrice(product: Product, quantity: number, offers: OffersConfig | null | undefined): number {
  const { applied } = resolveVolumeTier(product, quantity, offers);
  const base = applied ? applied.priceDA : product.priceDA;
  return calculateDiscountedPrice(base, product.discountPercent);
}

// ---------- cart computation ----------

export interface ComputedLine {
  productId: string;
  quantity: number;
  listPriceDA: number;
  unitPriceDA: number;
  lineTotalDA: number;
  appliedTier?: VolumeTier;
  nextTier?: VolumeTier;
}

export interface ComputedCart {
  lines: ComputedLine[];
  subtotalDA: number;
  bundles: { id: string; name: string; sets: number; amountDA: number }[];
  bundleDiscountDA: number;
  orderPercent: number;
  orderPercentSource: 'reward' | 'loyalty' | null;
  orderDiscountDA: number;
  totalDA: number;
  discountDA: number;
  minOrderDA: number;
  minOrderMet: boolean;
  missingForMinDA: number;
  reachedTiers: RewardTier[];
  nextTier: RewardTier | null;
  remainingToNextDA: number;
  freeDelivery: boolean;
  gifts: string[];
  loyaltyTier?: LoyaltyTier;
  appliedOffers: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeCart(
  items: { product: Product; quantity: number }[],
  offers: OffersConfig | null | undefined,
  loyaltyTier?: LoyaltyTier | null
): ComputedCart {
  const cfg = offers || normalizeOffers(null);
  const valid = items.filter((i) => i && i.product && i.quantity > 0);

  const lines: ComputedLine[] = valid.map((i) => {
    const { applied, next } = resolveVolumeTier(i.product, i.quantity, cfg);
    const unit = getUnitPrice(i.product, i.quantity, cfg);
    return {
      productId: i.product.id,
      quantity: i.quantity,
      listPriceDA: i.product.priceDA,
      unitPriceDA: unit,
      lineTotalDA: round2(unit * i.quantity),
      appliedTier: applied,
      nextTier: next,
    };
  });
  const subtotalDA = round2(lines.reduce((s, l) => s + l.lineTotalDA, 0));
  const appliedOffers: string[] = [];
  lines.forEach((l) => {
    const p = valid.find((i) => i.product.id === l.productId)!.product;
    if (l.appliedTier) appliedOffers.push(`Prix volume ${p.code} ≥ ${l.appliedTier.minQty}`);
  });

  // Bundles: every complete set found in the cart gets the bundle's percent off its components.
  const bundles: ComputedCart['bundles'] = [];
  if (cfg.bundles.enabled) {
    for (const b of cfg.bundles.items as Bundle[]) {
      if (!b.isActive || !b.items.length || !(b.discountPercent > 0)) continue;
      let sets = Infinity;
      for (const bi of b.items) {
        const line = lines.find((l) => l.productId === bi.productId);
        sets = Math.min(sets, line ? Math.floor(line.quantity / Math.max(1, bi.quantity)) : 0);
      }
      if (!Number.isFinite(sets) || sets < 1) continue;
      let base = 0;
      for (const bi of b.items) {
        const line = lines.find((l) => l.productId === bi.productId)!;
        base += line.unitPriceDA * bi.quantity * sets;
      }
      const amountDA = round2((base * b.discountPercent) / 100);
      bundles.push({ id: b.id, name: b.name, sets, amountDA });
      appliedOffers.push(`Pack ${b.name} ×${sets} (-${b.discountPercent}%)`);
    }
  }
  const bundleDiscountDA = round2(bundles.reduce((s, b) => s + b.amountDA, 0));
  const netBeforeOrder = Math.max(0, round2(subtotalDA - bundleDiscountDA));

  // Reward ladder, measured on the net amount
  const tiers = cfg.rewardLadder.enabled
    ? (cfg.rewardLadder.tiers as RewardTier[]).slice().sort((a, b) => a.thresholdDA - b.thresholdDA)
    : [];
  const reachedTiers = tiers.filter((t) => netBeforeOrder >= t.thresholdDA && valid.length > 0);
  const nextTier = tiers.find((t) => netBeforeOrder < t.thresholdDA) || null;
  const ladderPercent = reachedTiers
    .filter((t) => t.type === 'percent')
    .reduce((m, t) => Math.max(m, Number(t.value) || 0), 0);
  const freeDelivery = reachedTiers.some((t) => t.type === 'free_delivery');
  const gifts = reachedTiers.filter((t) => t.type === 'gift').map((t) => t.label);

  const loyaltyPercent = cfg.loyalty.enabled && loyaltyTier ? Number(loyaltyTier.discountPercent) || 0 : 0;
  const orderPercent = Math.max(ladderPercent, loyaltyPercent);
  const orderPercentSource: ComputedCart['orderPercentSource'] =
    orderPercent <= 0 ? null : loyaltyPercent >= ladderPercent ? 'loyalty' : 'reward';
  const orderDiscountDA = round2((netBeforeOrder * orderPercent) / 100);
  if (orderPercent > 0) {
    appliedOffers.push(
      orderPercentSource === 'loyalty' ? `Fidélité ${loyaltyTier?.name} (-${orderPercent}%)` : `Palier commande (-${orderPercent}%)`
    );
  }
  if (freeDelivery) appliedOffers.push('Livraison offerte');
  gifts.forEach((g) => appliedOffers.push(`Cadeau: ${g}`));

  const totalDA = Math.max(0, round2(netBeforeOrder - orderDiscountDA));
  const minOrderDA = cfg.minOrderAmountDA || 0;
  const minOrderMet = valid.length === 0 ? true : totalDA >= minOrderDA;

  return {
    lines,
    subtotalDA,
    bundles,
    bundleDiscountDA,
    orderPercent,
    orderPercentSource,
    orderDiscountDA,
    totalDA,
    discountDA: round2(bundleDiscountDA + orderDiscountDA),
    minOrderDA,
    minOrderMet,
    missingForMinDA: Math.max(0, round2(minOrderDA - totalDA)),
    reachedTiers,
    nextTier,
    remainingToNextDA: nextTier ? Math.max(0, round2(nextTier.thresholdDA - netBeforeOrder)) : 0,
    freeDelivery,
    gifts,
    loyaltyTier: loyaltyPercent > 0 && orderPercentSource === 'loyalty' ? loyaltyTier || undefined : undefined,
    appliedOffers,
  };
}

export function computeCartItems(items: CartItem[], offers: OffersConfig | null | undefined, tier?: LoyaltyTier | null) {
  return computeCart(items, offers, tier);
}

// ---------- loyalty ----------

export function pickLoyaltyTier(spendDA: number, offers: OffersConfig | null | undefined): LoyaltyTier | null {
  if (!offers || !offers.loyalty.enabled) return null;
  const tiers = (offers.loyalty.tiers as LoyaltyTier[]).slice().sort((a, b) => b.minSpendDA - a.minSpendDA);
  return tiers.find((t) => spendDA >= t.minSpendDA) || null;
}

export function nextLoyaltyTier(spendDA: number, offers: OffersConfig | null | undefined): LoyaltyTier | null {
  if (!offers || !offers.loyalty.enabled) return null;
  const tiers = (offers.loyalty.tiers as LoyaltyTier[]).slice().sort((a, b) => a.minSpendDA - b.minSpendDA);
  return tiers.find((t) => spendDA < t.minSpendDA) || null;
}

// ---------- cross-sell ----------

/** Default quantity to add for a suggestion (one sealed container for extraits, one unit otherwise). */
export function defaultAddQuantity(p: Product): number {
  if (p.family === 'Extrait') return Math.min(100, Math.max(1, p.stock));
  return 1;
}

export function suggestProducts(
  cart: CartItem[],
  products: Product[],
  offers: OffersConfig | null | undefined,
  isTopSeller: (p: Product) => boolean,
  popular?: Record<string, number>
): Product[] {
  if (!offers || !offers.crossSell.enabled || cart.length === 0) return [];
  const inCart = new Set(cart.map((c) => c.product.id));
  const usable = (p: Product) => p && !p.isHidden && p.stock > 0 && !inCart.has(p.id);
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: Product[] = [];
  const push = (p?: Product) => {
    if (p && usable(p) && !out.some((o) => o.id === p.id)) out.push(p);
  };

  // 1. Hand-picked relations from the admin
  cart.forEach((c) => (c.product.relatedProductIds || []).forEach((id) => push(byId.get(id))));

  // 2. Complementary families: extrait -> flacons and accessories; otherwise -> extraits
  const hasExtrait = cart.some((c) => c.product.family === 'Extrait');
  const wanted: Product['family'][] = hasExtrait ? ['Flacon', 'Accessoire'] : ['Extrait'];
  const rank = (p: Product) => (popular?.[p.id] || 0) * 10 + (isTopSeller(p) ? 5 : 0) + (p.discountPercent ? 1 : 0);
  wanted.forEach((fam) => {
    products
      .filter((p) => p.family === fam && usable(p))
      .sort((a, b) => rank(b) - rank(a))
      .slice(0, 3)
      .forEach(push);
  });

  // Interleave families so the list is not all flacons
  return out.slice(0, offers.crossSell.maxSuggestions);
}
