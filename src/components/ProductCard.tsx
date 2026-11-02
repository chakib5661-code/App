import React, { useState, useEffect } from 'react';
import { Plus, Minus, Check, Sparkles, Layers, Wrench, Package, Lock, XCircle, Heart, Flame, ZoomIn } from 'lucide-react';
import { OffersConfig, Product } from '../types';
import { volumeNudge } from '../utils/offers';
import { formatDZD } from '../utils/formatDZD';
import { AppLanguage, translations } from '../translations';
import { getProductLocalizedDetails } from '../data/productTranslations';
import { isProductTopSeller, calculateDiscountedPrice } from '../utils/productUtils';
import { cdnImage } from '../utils/cdnImage';

interface ProductCardProps {
  product: Product;
  cartQuantity: number;
  onAddToCart: (product: Product, quantity: number) => void;
  onDecreaseCartQuantity?: (productId: string, quantityToDecrease: number) => void;
  onQuickView?: (product: Product, openFullImage?: boolean) => void;
  isPricesVisible?: boolean;
  onRequireLogin?: () => void;
  lang?: AppLanguage;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
  isPriority?: boolean;
  offers?: OffersConfig | null;
  popularCount?: number;
}

const ProductCardComponent: React.FC<ProductCardProps> = ({
  product,
  cartQuantity,
  onAddToCart,
  onDecreaseCartQuantity,
  onQuickView,
  isPricesVisible = false,
  onRequireLogin,
  lang = 'ar',
  isFavorite = false,
  onToggleFavorite,
  isPriority = false,
  offers = null,
  popularCount = 0,
}) => {
  const t = translations[lang];
  const isExtrait = product.family === 'Extrait';
  const localized = getProductLocalizedDetails(product, lang);
  const isRtl = false; // Layout stays LTR for accessibility and right-handed reachability

  const hasDiscount = Boolean(product.discountPercent && product.discountPercent > 0);
  const discountedPriceDA = calculateDiscountedPrice(product.priceDA, product.discountPercent);

  const availableStock = Math.max(0, product.stock - cartQuantity);
  const isOutOfStock = product.stock <= 0;
  const isAllInCart = availableStock <= 0 && product.stock > 0;
  const isTopSeller = isProductTopSeller(product);

  // The quantity controls edit the cart line directly: what you see is what is in the cart.
  const step = isExtrait ? 100 : 1;
  const selectedQty = cartQuantity;
  const [qtyInputValue, setQtyInputValue] = useState<string>(String(cartQuantity));

  useEffect(() => {
    setQtyInputValue(String(cartQuantity));
  }, [cartQuantity]);

  const setCartTo = (target: number) => {
    const next = Math.max(0, Math.min(product.stock, Math.round(target)));
    const delta = next - cartQuantity;
    if (delta > 0) onAddToCart(product, delta);
    else if (delta < 0) onDecreaseCartQuantity?.(product.id, -delta);
    setQtyInputValue(String(next));
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQtyInputValue(e.target.value);
  };

  const handleBlur = () => {
    const parsed = parseInt(qtyInputValue, 10);
    if (isNaN(parsed) || parsed < 0) setQtyInputValue(String(cartQuantity));
    else setCartTo(parsed);
  };

  const increment = () => setCartTo(cartQuantity + step);
  const decrement = () => setCartTo(cartQuantity - step);
  const setPreset = (val: number) => setCartTo(val);

  const nudge = isPricesVisible && cartQuantity > 0 ? volumeNudge(product, cartQuantity, offers) : null;

  return (
    <div
      id={`product-card-${product.id}`}
      dir={isRtl ? 'rtl' : 'ltr'}
      className="bg-white rounded-2xl border border-rose-100/90 shadow-2xs hover:border-rose-300 hover:shadow-xl hover:shadow-rose-950/5 transition-all duration-300 overflow-hidden flex flex-col justify-between"
    >
      {/* Product Image & Badges */}
      <div
        onClick={() => {
          const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
          onQuickView?.(product, isMobile);
        }}
        className="relative h-36 sm:h-48 bg-slate-100 overflow-hidden group cursor-zoom-in"
        title="Cliquer pour afficher la photo en grand format et zoomer"
      >
        <img
          src={
            product.imageUrl && !product.imageUrl.includes('photo-1608571423902')
              ? cdnImage(product.imageUrl)
              : isExtrait
              ? '/tulip-extrait-default.jpg'
              : (product.imageUrl || 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600')
          }
          alt={localized.name}
          width={300}
          height={192}
          className="w-full h-full object-cover group-hover:scale-120 transition-transform duration-500 ease-out will-change-transform"
          loading={isPriority ? 'eager' : 'lazy'}
          fetchPriority={isPriority ? 'high' : 'auto'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.onerror = null;
            target.src = '/tulip-extrait-default.jpg';
          }}
        />

        {/* Quick Zoom Indicator on hover */}
        <div className="absolute bottom-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none transform translate-y-1 group-hover:translate-y-0">
          <span className="px-2.5 py-1 rounded-xl bg-slate-950/80 text-white text-[10px] font-bold backdrop-blur-xs flex items-center gap-1.5 shadow-md border border-white/20">
            <ZoomIn className="w-3.5 h-3.5 text-pink-300" />
            <span>Zoom HD</span>
          </span>
        </div>

        {/* Top Badges: Family & Big Solde Sticker */}
        <div className={`absolute top-2.5 ${isRtl ? 'right-2.5' : 'left-2.5'} flex flex-col gap-1.5 items-start z-10`}>
          <span
            className={`max-sm:hidden px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm ${
              isExtrait
                ? 'bg-pink-50 text-[#880e4f] border border-pink-200/90'
                : product.family === 'Accessoire'
                ? 'bg-teal-50 text-teal-900 border border-teal-200/90'
                : 'bg-rose-50 text-[#70083b] border border-rose-200/90'
            }`}
          >
            {isExtrait ? (
              <Sparkles className="w-3.5 h-3.5 text-[#9f0e4e]" />
            ) : product.family === 'Accessoire' ? (
              <Wrench className="w-3.5 h-3.5 text-teal-700" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-[#880e4f]" />
            )}
            {isExtrait
              ? t.extraitsTitle.split(' ')[0]
              : product.family === 'Accessoire'
              ? (t.accessoriesTitle ? t.accessoriesTitle.split(' ')[0] : 'Accessoires')
              : t.flaconsTitle.split(' ')[0]}
          </span>

          {/* BIG PROMO / SOLDE STICKER */}
          {hasDiscount && (
            <span className="px-3.5 py-1 max-sm:px-2 max-sm:py-0.5 rounded-full text-xs max-sm:text-[11px] sm:text-sm font-black bg-gradient-to-r from-[#9f0e4e] to-[#e11d48] text-white shadow-lg flex items-center gap-1.5 tracking-wider uppercase border-2 border-white sm:animate-bounce">
              <span>🔥 -{product.discountPercent}%</span>
              <span className="max-sm:hidden">{t.soldeBadge}</span>
            </span>
          )}

          {/* TOP SELLER BADGE */}
          {isTopSeller && !hasDiscount && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-gradient-to-r from-[#c5a059] to-[#d4af37] text-slate-950 shadow-xs flex items-center gap-1 border border-amber-300">
              <Flame className="w-3 h-3 fill-slate-950 text-slate-950" />
              <span>{t.topSellerBadge}</span>
            </span>
          )}

          {localized.category && (
            <span className="max-sm:hidden px-2 py-0.5 rounded-md text-[10px] bg-slate-900/80 text-slate-100 backdrop-blur-xs font-medium">
              {localized.category}
            </span>
          )}
        </div>

        {/* Origin Pill */}
        {localized.origin && (
          <div className={`max-sm:hidden absolute bottom-2 ${isRtl ? 'right-2.5' : 'left-2.5'}`}>
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/90 text-slate-700 font-medium backdrop-blur-xs border border-slate-200">
              {localized.origin}
            </span>
          </div>
        )}

        {/* Stock Level Badge & Favorite Heart Button */}
        <div className={`absolute top-2.5 ${isRtl ? 'left-2.5' : 'right-2.5'} z-10 flex items-center gap-1.5`}>
          {isOutOfStock ? (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-xs">
              <XCircle className="w-3.5 h-3.5" />
              {t.filterOutOfStock}
            </span>
          ) : (
            <span className="max-sm:hidden px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              {t.filterInStock}
            </span>
          )}

          {/* Favorite Toggle Button */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(product.id);
              }}
              className={`p-2.5 sm:p-1.5 rounded-full backdrop-blur-md shadow-xs transition cursor-pointer ${
                isFavorite
                  ? 'bg-rose-500 text-white hover:bg-rose-600 scale-105 shadow-rose-500/30'
                  : 'bg-white/90 hover:bg-white text-slate-400 hover:text-rose-500 border border-slate-200'
              }`}
              title={isFavorite ? t.removeFromFavorites : t.addToFavorites}
              aria-label={isFavorite ? t.removeFromFavorites : t.addToFavorites}
            >
              <Heart className={`w-4 h-4 sm:w-3.5 sm:h-3.5 transition-transform ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Product Content Details */}
      <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold text-[11px] border border-slate-200">
              {product.code}
            </span>
            <span className="text-slate-600 font-semibold flex items-center gap-1 min-w-0 truncate max-sm:text-[10px]">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              {isExtrait ? '1g (Scellé 100g)' : product.unit}
            </span>
          </div>

          <h3
            className="text-sm sm:text-base font-black text-slate-900 line-clamp-2 leading-snug cursor-pointer hover:text-amber-700 transition-colors"
            onClick={() => onQuickView?.(product)}
            title={localized.name}
          >
            {localized.name}
          </h3>

          {localized.description && (
            <p className="max-sm:hidden text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
              {localized.description}
            </p>
          )}

          {/* Extrait container size badge */}
          {isExtrait && (
            <div className="max-sm:hidden mt-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl p-2 px-2.5 text-[11px] text-amber-950 flex items-center justify-between font-medium">
              <span>{t.container100g}</span>
              <span className="font-bold text-amber-800">
                {isPricesVisible ? (
                  formatDZD((hasDiscount ? discountedPriceDA : product.priceDA) * 100)
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    {t.confidentialPriceBadge}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Phone: one short line instead of the container box */}
          {isExtrait && (
            <div className="sm:hidden mt-1 text-[11px] font-bold text-amber-800 flex items-center gap-1">
              <span>100g</span>
              <span>·</span>
              {isPricesVisible ? (
                <span>{formatDZD((hasDiscount ? discountedPriceDA : product.priceDA) * 100)}</span>
              ) : (
                <Lock className="w-3 h-3" aria-label={t.confidentialPriceBadge} />
              )}
            </div>
          )}
        </div>

        {popularCount > 0 && (
          <div className="mt-1.5 sm:mt-2 text-xs sm:text-[11px] font-bold text-[#70083b] flex items-center gap-1">
            <span>🔥</span>
            <span>
              {lang === 'ar'
                ? `طلبه ${popularCount} عملاء هذا الشهر`
                : `Commandé par ${popularCount} clients récemment`}
            </span>
          </div>
        )}

        {/* Pricing and Action Row */}
        <div className="mt-2 pt-2 sm:mt-3 sm:pt-3 border-t border-slate-100">
          {!isPricesVisible ? (
            <div className="flex items-center justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-2 mb-2.5 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{t.priceHiddenNotice}</span>
              </div>
              <button
                type="button"
                onClick={onRequireLogin}
                className="px-3 py-1 rounded-lg bg-[#9f0e4e] hover:bg-[#880e4f] text-white text-[11px] font-black shadow-sm transition active:scale-95 cursor-pointer shrink-0"
              >
                {t.loginBtn}
              </button>
            </div>
          ) : (
            <div className="flex items-baseline justify-between mb-2.5">
              <div>
                <span className="text-xs sm:text-[10px] text-slate-500 font-medium block">
                  {isExtrait ? t.perGram : t.perPiece}
                </span>
                {hasDiscount ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base sm:text-xl font-black text-rose-600">
                      {formatDZD(discountedPriceDA)}
                    </span>
                    <span className="text-xs text-slate-400 line-through">
                      {formatDZD(product.priceDA)}
                    </span>
                    {isExtrait && (
                      <span className="text-xs font-bold text-rose-700">/ 1g</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-xl font-black text-slate-950">
                      {formatDZD(product.priceDA)}
                    </span>
                    {isExtrait && (
                      <span className="text-xs font-bold text-amber-700">/ 1g</span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right max-sm:hidden">
                <span className="text-[10px] text-slate-400 font-medium block">
                  {isExtrait ? 'Dans le bon' : 'Total estimé'}
                </span>
                {isExtrait && (
                  <span className="text-xs font-bold text-slate-700 font-mono">
                    {formatDZD(discountedPriceDA * selectedQty)} ({selectedQty}g)
                  </span>
                )}
              </div>
            </div>
          )}

          {isPricesVisible && nudge && nudge.missing <= availableStock && (
            <div className="mb-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between max-sm:flex-col max-sm:items-stretch gap-2">
              <span className="leading-snug">
                <b className="text-sm">
                  {lang === 'ar' ? 'أضف' : 'Ajoutez'} <bdi dir="ltr">+{nudge.missing}{isExtrait ? ' g' : ' pcs'}</bdi>
                </b>
                <br />
                <bdi dir="ltr">
                  {formatDZD(nudge.nextUnit)}{isExtrait ? '/g' : '/u'}
                </bdi>{' '}
                <span className="text-emerald-800/80">
                  ({lang === 'ar' ? 'بدل' : 'au lieu de'} <bdi dir="ltr">{formatDZD(nudge.currentUnit)}</bdi>)
                </span>
                <br />
                {lang === 'ar' ? 'توفر' : 'Économie'} <b><bdi dir="ltr">{formatDZD(nudge.savingDA)}</bdi></b>
              </span>
              <button
                type="button"
                onClick={() => setPreset(nudge.minQty)}
                className="shrink-0 px-3 py-2.5 sm:py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black cursor-pointer"
              >
                {lang === 'ar' ? `إلى ${nudge.minQty}` : `Passer à ${nudge.minQty}${isExtrait ? ' g' : ''}`}
              </button>
            </div>
          )}

          {/* Extrait quick preset buttons */}
          {isExtrait && !isOutOfStock && (
            <div className="max-sm:hidden flex flex-wrap items-center gap-1.5 mb-2.5 text-xs sm:text-[10px]">
              <span className="max-sm:hidden text-slate-400 font-semibold mr-0.5">Presets :</span>
              {[100, 200, 300, 500].map((presetG) => {
                if (presetG > product.stock && presetG !== 100) return null;
                return (
                  <button
                    key={presetG}
                    type="button"
                    onClick={() => setPreset(presetG)}
                    className={`px-2 py-0.5 max-sm:px-2.5 max-sm:py-1.5 rounded-md border font-bold transition cursor-pointer ${
                      selectedQty === presetG
                        ? 'bg-[#9f0e4e] text-white border-[#70083b] shadow-2xs'
                        : 'bg-rose-50/60 text-slate-700 border-rose-200/80 hover:bg-rose-100/60'
                    }`}
                  >
                    {presetG}g
                  </button>
                );
              })}
            </div>
          )}

          {/* Cart Quantity & Add Controls */}
          {isOutOfStock ? (
            <button
              disabled
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed text-center border border-slate-200"
            >
              {t.outOfStock}
            </button>
          ) : cartQuantity === 0 ? (
            <button
              type="button"
              onClick={() => setCartTo(isExtrait ? Math.min(100, product.stock) : 1)}
              className="w-full py-3 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white flex items-center justify-center gap-2 text-sm sm:text-xs font-black shadow-md active:scale-95 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إضافة' : 'Ajouter'}</span>
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200/90 bg-rose-50/40 overflow-hidden">
              <button
                type="button"
                onClick={decrement}
                disabled={cartQuantity <= 0}
                className="px-3.5 py-3 sm:px-3.5 sm:py-2 shrink-0 text-[#9f0e4e] hover:bg-rose-100/70 disabled:opacity-30 transition-colors cursor-pointer"
                aria-label="Diminuer la quantité"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex items-center justify-center flex-1 min-w-0 gap-0.5">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={product.stock}
                  value={qtyInputValue}
                  onChange={handleQtyChange}
                  onBlur={handleBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className={`w-16 shrink-0 p-0 text-center text-base sm:text-sm font-black bg-transparent focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    cartQuantity > 0 ? 'text-emerald-800' : 'text-slate-400'
                  }`}
                  aria-label="Quantité dans le bon"
                />
                <span className="text-[11px] text-[#880e4f] font-bold shrink-0 w-2.5">{isExtrait ? 'g' : ''}</span>
              </div>
              <button
                type="button"
                onClick={increment}
                disabled={cartQuantity >= product.stock}
                className="px-3.5 py-3 sm:px-3.5 sm:py-2 shrink-0 text-[#9f0e4e] hover:bg-rose-100/70 disabled:opacity-30 transition-colors cursor-pointer"
                aria-label="Augmenter la quantité"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ProductCard = React.memo(ProductCardComponent);
