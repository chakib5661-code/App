import React, { useMemo } from 'react';
import { Check, Gift, Package, Plus } from 'lucide-react';
import { Bundle, CartItem, OffersConfig, Product } from '../types';
import { getUnitPrice } from '../utils/offers';
import { formatDZD } from '../utils/formatDZD';

interface PacksHeaderProps {
  offers: OffersConfig;
  products: Product[];
  cart: CartItem[];
  isPricesVisible: boolean;
  lang?: string;
  onAddPack: (bundle: Bundle) => void;
}

/** Header banner for the store's packs: one card per active pack with its contents, saving and add button. */
export const PacksHeader: React.FC<PacksHeaderProps> = ({ offers, products, cart, isPricesVisible, lang = 'fr', onAddPack }) => {
  const tr = (ar: string, fr: string) => (lang === 'ar' ? ar : fr);

  const packs = useMemo(() => {
    if (!offers.bundles.enabled) return [];
    return offers.bundles.items
      .filter((b) => b.isActive && b.items.length > 0)
      .map((b) => {
        const lines = b.items.map((bi) => ({ ...bi, product: products.find((p) => p.id === bi.productId) }));
        const available = lines.every((l) => l.product && !l.product.isHidden && l.product.stock >= l.quantity);
        const full = lines.reduce((s, l) => s + (l.product ? getUnitPrice(l.product, l.quantity, offers) * l.quantity : 0), 0);
        const inCart = lines.every((l) => (cart.find((c) => c.product.id === l.productId)?.quantity || 0) >= l.quantity);
        return { bundle: b, lines, available, full, saving: (full * b.discountPercent) / 100, inCart };
      })
      .filter((p) => p.available || p.inCart);
  }, [offers, products, cart]);

  if (packs.length === 0) return null;

  return (
    <section aria-label={tr('عروض الباقات', 'Packs Tulip')} className="w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2b0316] via-[#500428] to-[#9f0e4e] p-3.5 sm:p-7 shadow-xl">
          <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-rose-400/10 blur-3xl pointer-events-none" />

          <div className="relative flex flex-wrap items-end justify-between gap-3 mb-3 sm:mb-5">
            <div>
              <div className="max-sm:hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-300/30 text-amber-200 text-[11px] font-black uppercase tracking-widest">
                <Gift className="w-3.5 h-3.5" />
                {tr('عروض حصرية', 'Offres exclusives')}
              </div>
              <h2 className="sm:mt-2 text-lg sm:text-3xl font-black text-white tracking-tight">
                {tr('باقات تيوليب', 'Les Packs Tulip')}
              </h2>
              <p className="max-sm:hidden text-xs sm:text-sm text-rose-100/85 mt-1 max-w-xl">
                {tr(
                  'مجموعات جاهزة من المواد الأولية بسعر مخفّض. أضف الباقة كاملة بنقرة واحدة.',
                  'Des sélections prêtes à commander à prix réduit. Ajoutez le pack complet en un geste.'
                )}
              </p>
            </div>
          </div>

          <div className="relative flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
            {packs.map(({ bundle, lines, full, saving, inCart, available }) => (
              <article
                key={bundle.id}
                className="snap-start shrink-0 w-[250px] sm:w-[300px] bg-white/[0.07] backdrop-blur-sm border border-white/15 rounded-2xl p-4 flex flex-col justify-between text-white"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-amber-200" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-black">
                        -{bundle.discountPercent}%
                      </span>
                      {bundle.badgeText && (
                        <span className="px-2 py-0.5 rounded-full bg-white/15 text-rose-100 text-[10px] font-bold">
                          {bundle.badgeText}
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="mt-3 text-base font-black leading-snug">{bundle.name}</h3>
                  {bundle.description && <p className="text-[11px] text-rose-100/80 mt-0.5">{bundle.description}</p>}
                  <ul className="mt-3 space-y-1 text-xs text-rose-50/95">
                    {lines.map((l) => (
                      <li key={l.productId} className="flex items-center justify-between gap-2">
                        <span className="truncate">{l.product?.name || l.productId}</span>
                        <span className="font-mono text-amber-200 shrink-0">
                          {l.product?.family === 'Extrait' ? `${l.quantity} g` : `× ${l.quantity}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 space-y-2">
                  {isPricesVisible && (
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-rose-100/70 line-through">{formatDZD(full)}</span>
                      <span className="text-lg font-black text-white">{formatDZD(full - saving)}</span>
                    </div>
                  )}
                  {isPricesVisible && (
                    <div className="text-xs font-bold text-amber-200">
                      {tr('توفر', 'Vous économisez')} {formatDZD(saving)}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={inCart || !available}
                    onClick={() => onAddPack(bundle)}
                    className={`w-full py-3 sm:py-2.5 rounded-xl text-sm sm:text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      inCart
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 cursor-default'
                        : 'bg-amber-400 hover:bg-amber-300 text-amber-950 shadow-lg'
                    }`}
                  >
                    {inCart ? (
                      <>
                        <Check className="w-4 h-4" /> {tr('الباقة في السلة', 'Pack dans le panier')}
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> {tr('أضف الباقة', 'Ajouter le pack')}
                      </>
                    )}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!isPricesVisible && (
            <p className="relative mt-3 text-[11px] text-rose-100/70">
              {tr('سجّل الدخول لرؤية الأسعار والتوفير.', 'Connectez-vous pour voir les prix et votre économie.')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
