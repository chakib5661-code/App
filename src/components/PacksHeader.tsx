import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Gift, Minus, Package, Plus, Search, X } from 'lucide-react';
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

type PackEntry = {
  bundle: Bundle;
  lines: { productId: string; quantity: number; product?: Product }[];
  full: number;
  saving: number;
  inCart: boolean;
  available: boolean;
};

const ImageViewer: React.FC<{ src: string; alt: string; onClose: () => void }> = ({ src, alt, onClose }) => {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const zoom = (d: number) =>
    setScale((s) => {
      const n = Math.min(5, Math.max(1, s + d));
      if (n === 1) setPos({ x: 0, y: 0 });
      return n;
    });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') zoom(0.5);
      if (e.key === '-') zoom(-0.5);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col" role="dialog" aria-label={alt}>
      <button type="button" onClick={onClose} aria-label="Fermer" className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer">
        <X className="w-5 h-5" />
      </button>
      <div
        className={`flex-1 overflow-hidden flex items-center justify-center touch-none ${scale > 1 ? 'cursor-grab' : 'cursor-zoom-in'}`}
        onWheel={(e) => zoom(e.deltaY < 0 ? 0.25 : -0.25)}
        onDoubleClick={() => (scale > 1 ? zoom(-5) : zoom(1.5))}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }}
        onPointerMove={(e) => {
          if (drag.current && scale > 1) setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-[94vw] max-h-[80vh] select-none"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transition: drag.current ? 'none' : 'transform .15s' }}
        />
      </div>
      <div className="flex items-center justify-center gap-2 p-4">
        <button type="button" onClick={() => zoom(-0.5)} aria-label="Zoom -" className="w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer"><Minus className="w-5 h-5" /></button>
        <button type="button" onClick={() => zoom(-5)} className="px-4 h-11 rounded-full bg-white/15 text-white text-xs font-bold cursor-pointer">1:1</button>
        <button type="button" onClick={() => zoom(0.5)} aria-label="Zoom +" className="w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer"><Plus className="w-5 h-5" /></button>
      </div>
    </div>
  );
};

const PackDetailModal: React.FC<{
  pack: PackEntry;
  isPricesVisible: boolean;
  tr: (ar: string, fr: string) => string;
  onClose: () => void;
  onAdd: () => void;
}> = ({ pack, isPricesVisible, tr, onClose, onAdd }) => {
  const { bundle, lines, full, saving, inCart, available } = pack;
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !zoomed) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, zoomed]);
  return (
    <div
      className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-label={bundle.name}
    >
      <div className="relative w-full max-w-2xl max-h-[94vh] overflow-y-auto rounded-2xl bg-[#1c0210] border border-white/15 text-white shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Fermer" className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        {bundle.imageUrl ? (
          <button type="button" onClick={() => setZoomed(true)} className="relative block w-full cursor-zoom-in" aria-label={tr('تكبير الصورة', "Agrandir l'image")}>
            <img src={bundle.imageUrl} alt={bundle.name} className="w-full h-[40vh] sm:h-[380px] object-cover" />
            <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-xs font-black">-{bundle.discountPercent}%</span>
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 text-[11px] font-bold">
              <Search className="w-3.5 h-3.5" /> {tr('اضغط للتكبير', 'Toucher pour zoomer')}
            </span>
          </button>
        ) : (
          <div className="h-24 bg-gradient-to-br from-[#500428] to-[#9f0e4e] flex items-center px-5 gap-3">
            <Package className="w-8 h-8 text-amber-200" />
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-xs font-black">-{bundle.discountPercent}%</span>
          </div>
        )}
        <div className="p-5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black">{bundle.name}</h2>
            {bundle.badgeText && <span className="px-2 py-0.5 rounded-full bg-white/15 text-rose-100 text-[10px] font-bold">{bundle.badgeText}</span>}
          </div>
          {bundle.description && <p className="text-sm text-rose-100/80 mt-1">{bundle.description}</p>}
          <ul className="mt-3 border-t border-white/10">
            {lines.map((l) => (
              <li key={l.productId} className="flex items-center justify-between gap-3 py-2 border-b border-white/10 text-sm">
                <span className="truncate">{l.product?.name || l.productId}</span>
                <span className="font-mono text-amber-200 shrink-0">{l.product?.family === 'Extrait' ? `${l.quantity} g` : `× ${l.quantity}`}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {isPricesVisible && (
              <div>
                <div className="text-xs text-rose-100/70 line-through">{formatDZD(full)}</div>
                <div className="text-2xl font-black">{formatDZD(full - saving)}</div>
                <div className="text-xs font-bold text-amber-200">{tr('توفر', 'Vous économisez')} {formatDZD(saving)}</div>
              </div>
            )}
            <button
              type="button"
              disabled={inCart || !available}
              onClick={onAdd}
              className={`flex-1 min-w-[180px] py-3 rounded-xl text-sm font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                inCart ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 cursor-default' : 'bg-amber-400 hover:bg-amber-300 text-amber-950'
              }`}
            >
              {inCart ? (<><Check className="w-4 h-4" /> {tr('الباقة في السلة', 'Pack dans le panier')}</>) : (<><Plus className="w-4 h-4" /> {tr('أضف الباقة', 'Ajouter le pack')}</>)}
            </button>
          </div>
        </div>
      </div>
      {zoomed && bundle.imageUrl && <ImageViewer src={bundle.imageUrl} alt={bundle.name} onClose={() => setZoomed(false)} />}
    </div>
  );
};

/** Header banner for the store's packs: one card per active pack with its contents, saving and add button. */
export const PacksHeader: React.FC<PacksHeaderProps> = ({ offers, products, cart, isPricesVisible, lang = 'fr', onAddPack }) => {
  const tr = (ar: string, fr: string) => (lang === 'ar' ? ar : fr);
  const [openId, setOpenId] = useState<string | null>(null);

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
                className={`snap-start shrink-0 ${bundle.imageUrl ? 'w-[290px] sm:w-[360px]' : 'w-[250px] sm:w-[300px]'} bg-white/[0.07] backdrop-blur-sm border border-white/15 rounded-2xl overflow-hidden flex flex-col justify-between text-white`}
              >
                {bundle.imageUrl && (
                  <div className="relative">
                    <img src={bundle.imageUrl} alt={bundle.name} loading="lazy" onClick={() => setOpenId(bundle.id)} className="w-full h-48 sm:h-56 object-cover cursor-pointer" />
                    <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-black shadow">
                      -{bundle.discountPercent}%
                    </span>
                    {bundle.badgeText && (
                      <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/55 text-rose-100 text-[10px] font-bold">
                        {bundle.badgeText}
                      </span>
                    )}
                  </div>
                )}
                <div className="p-4 pb-0">
                  {!bundle.imageUrl && (
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
                  )}
                  <h3 className={`${bundle.imageUrl ? '' : 'mt-3'} text-base font-black leading-snug`}>{bundle.name}</h3>
                  {bundle.description && <p className="text-[11px] text-rose-100/80 mt-0.5">{bundle.description}</p>}
                  <button
                    type="button"
                    onClick={() => setOpenId(bundle.id)}
                    className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-200 hover:text-amber-100 cursor-pointer"
                  >
                    {tr('عرض التفاصيل', 'Voir les détails')}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-4 pt-3 space-y-2">
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
      {(() => {
        const sel = packs.find((p) => p.bundle.id === openId);
        if (!sel) return null;
        return (
          <PackDetailModal
            pack={sel}
            isPricesVisible={isPricesVisible}
            tr={tr}
            onClose={() => setOpenId(null)}
            onAdd={() => onAddPack(sel.bundle)}
          />
        );
      })()}
    </section>
  );
};
