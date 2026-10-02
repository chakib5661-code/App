import React, { useState, useEffect } from 'react';
import { Plus, Minus, Check, Sparkles, Layers, Wrench, Package, Lock, XCircle, Heart, Flame } from 'lucide-react';
import { Product } from '../types';
import { formatDZD } from '../utils/pdfGenerator';
import { AppLanguage, translations } from '../translations';
import { getProductLocalizedDetails } from '../data/productTranslations';
import { isProductTopSeller, calculateDiscountedPrice } from '../utils/productUtils';

interface ProductCardProps {
  product: Product;
  cartQuantity: number;
  onAddToCart: (product: Product, quantity: number) => void;
  onDecreaseCartQuantity?: (productId: string, quantityToDecrease: number) => void;
  onQuickView?: (product: Product) => void;
  isPricesVisible?: boolean;
  onRequireLogin?: () => void;
  lang?: AppLanguage;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
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

  // For Extrait: default to 100g (1 full container) or remaining stock
  const step = isExtrait ? 100 : 1;
  const defaultQty = isExtrait ? Math.min(100, Math.max(1, availableStock)) : 1;
  const [selectedQty, setSelectedQty] = useState<number>(defaultQty);
  const [qtyInputValue, setQtyInputValue] = useState<string>(String(defaultQty));

  useEffect(() => {
    if (availableStock > 0 && selectedQty > availableStock) {
      setSelectedQty(availableStock);
      setQtyInputValue(String(availableStock));
    }
  }, [availableStock]);

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setQtyInputValue(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(availableStock > 0 ? availableStock : 9999, parsed);
      setSelectedQty(clamped);
    }
  };

  const handleBlur = () => {
    const parsed = parseInt(qtyInputValue, 10);
    if (isNaN(parsed) || parsed < 1) {
      const fallback = Math.max(1, Math.min(availableStock > 0 ? availableStock : 1, defaultQty));
      setSelectedQty(fallback);
      setQtyInputValue(String(fallback));
    } else {
      const clamped = Math.max(1, Math.min(availableStock > 0 ? availableStock : 1, parsed));
      setSelectedQty(clamped);
      setQtyInputValue(String(clamped));
    }
  };

  const increment = () => {
    const next = Math.min(availableStock, selectedQty + step);
    setSelectedQty(next);
    setQtyInputValue(String(next));
  };

  const decrement = () => {
    const next = Math.max(1, selectedQty - step);
    setSelectedQty(next);
    setQtyInputValue(String(next));
  };

  const setPreset = (val: number) => {
    const clamped = Math.min(availableStock, val);
    setSelectedQty(clamped);
    setQtyInputValue(String(clamped));
  };

  const handleAdd = () => {
    if (availableStock <= 0) return;
    const qtyToAdd = Math.min(selectedQty, availableStock);
    onAddToCart(product, qtyToAdd);
    // Reset selectedQty for next add
    const remaining = Math.max(0, availableStock - qtyToAdd);
    if (remaining > 0) {
      const nextDefault = isExtrait ? Math.min(100, remaining) : 1;
      setSelectedQty(nextDefault);
      setQtyInputValue(String(nextDefault));
    }
  };

  return (
    <div
      id={`product-card-${product.id}`}
      dir={isRtl ? 'rtl' : 'ltr'}
      className="bg-white rounded-2xl border border-rose-100/90 shadow-2xs hover:border-rose-300 hover:shadow-xl hover:shadow-rose-950/5 transition-all duration-300 overflow-hidden flex flex-col justify-between"
    >
      {/* Product Image & Badges */}
      <div className="relative h-48 bg-slate-100 overflow-hidden group">
        <img
          src={
            product.imageUrl && !product.imageUrl.includes('photo-1608571423902')
              ? product.imageUrl
              : isExtrait
              ? '/tulip-extrait-default.jpg'
              : (product.imageUrl || 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600')
          }
          alt={localized.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.onerror = null;
            target.src = '/tulip-extrait-default.jpg';
          }}
        />

        {/* Top Badges: Family & Big Solde Sticker */}
        <div className={`absolute top-2.5 ${isRtl ? 'right-2.5' : 'left-2.5'} flex flex-col gap-1.5 items-start z-10`}>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm ${
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
            <span className="px-3.5 py-1 rounded-full text-xs sm:text-sm font-black bg-gradient-to-r from-[#9f0e4e] to-[#e11d48] text-white shadow-lg flex items-center gap-1.5 tracking-wider uppercase border-2 border-white animate-bounce">
              <span>🔥 -{product.discountPercent}%</span>
              <span>{t.soldeBadge}</span>
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
            <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-900/80 text-slate-100 backdrop-blur-xs font-medium">
              {localized.category}
            </span>
          )}
        </div>

        {/* Origin Pill */}
        {localized.origin && (
          <div className={`absolute bottom-2 ${isRtl ? 'right-2.5' : 'left-2.5'}`}>
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
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 shadow-xs">
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
              className={`p-1.5 rounded-full backdrop-blur-md shadow-xs transition cursor-pointer ${
                isFavorite
                  ? 'bg-rose-500 text-white hover:bg-rose-600 scale-105 shadow-rose-500/30'
                  : 'bg-white/90 hover:bg-white text-slate-400 hover:text-rose-500 border border-slate-200'
              }`}
              title={isFavorite ? t.removeFromFavorites : t.addToFavorites}
              aria-label={isFavorite ? t.removeFromFavorites : t.addToFavorites}
            >
              <Heart className={`w-3.5 h-3.5 transition-transform ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Product Content Details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold text-[11px] border border-slate-200">
              {product.code}
            </span>
            <span className="text-slate-600 font-semibold flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              {isExtrait ? '1g (Scellé 100g)' : product.unit}
            </span>
          </div>

          <h3
            className="text-base font-black text-slate-900 line-clamp-2 leading-snug cursor-pointer hover:text-amber-700 transition-colors"
            onClick={() => onQuickView?.(product)}
            title={localized.name}
          >
            {localized.name}
          </h3>

          {localized.description && (
            <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
              {localized.description}
            </p>
          )}

          {/* Extrait container size badge */}
          {isExtrait && (
            <div className="mt-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl p-2 px-2.5 text-[11px] text-amber-950 flex items-center justify-between font-medium">
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
        </div>

        {/* Pricing and Action Row */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          {!isPricesVisible ? (
            <div className="flex items-center justify-between mb-2.5 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{t.priceHiddenNotice}</span>
              </div>
              <button
                type="button"
                onClick={onRequireLogin}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 hover:underline cursor-pointer"
              >
                {t.loginBtn}
              </button>
            </div>
          ) : (
            <div className="flex items-baseline justify-between mb-2.5">
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">
                  {isExtrait ? t.perGram : t.perPiece}
                </span>
                {hasDiscount ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-rose-600">
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
                    <span className="text-xl font-black text-slate-950">
                      {formatDZD(product.priceDA)}
                    </span>
                    {isExtrait && (
                      <span className="text-xs font-bold text-amber-700">/ 1g</span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-medium block">
                  {isExtrait ? 'Sous-total sélectionné' : 'Total estimé'}
                </span>
                {isExtrait && (
                  <span className="text-xs font-bold text-slate-700 font-mono">
                    {formatDZD(discountedPriceDA * selectedQty)} ({selectedQty}g)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Extrait quick preset buttons */}
          {isExtrait && !isOutOfStock && !isAllInCart && (
            <div className="flex items-center gap-1.5 mb-2.5 text-[10px]">
              <span className="text-slate-400 font-semibold mr-0.5">Presets :</span>
              {[100, 200, 300, 500].map((presetG) => {
                if (presetG > availableStock && presetG !== 100) return null;
                return (
                  <button
                    key={presetG}
                    type="button"
                    onClick={() => setPreset(presetG)}
                    className={`px-2 py-0.5 rounded-md border font-bold transition cursor-pointer ${
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
          ) : isAllInCart ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-2 px-3 text-center">
              <span className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                ✓ Tout le stock disponible est dans votre bon ({cartQuantity}{isExtrait ? 'g' : ''})
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {/* Stepper with robust text input */}
                <div className="flex items-center border border-rose-200/90 rounded-xl overflow-hidden bg-rose-50/40 shadow-inner">
                  <button
                    type="button"
                    onClick={decrement}
                    disabled={selectedQty <= 1}
                    className="px-2.5 py-2 text-slate-700 hover:bg-rose-100/70 disabled:opacity-30 transition-colors cursor-pointer"
                    aria-label="Diminuer la quantité"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <div className="px-1 flex items-center">
                    <input
                      type="number"
                      min={1}
                      max={availableStock}
                      value={qtyInputValue}
                      onChange={handleQtyChange}
                      onBlur={handleBlur}
                      className="w-14 text-center text-xs font-bold text-slate-900 bg-transparent focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[10px] text-[#880e4f] font-bold pr-1">{isExtrait ? 'g' : ''}</span>
                  </div>

                  <button
                    type="button"
                    onClick={increment}
                    disabled={selectedQty >= availableStock}
                    className="px-2.5 py-2 text-slate-700 hover:bg-rose-100/70 disabled:opacity-30 transition-colors cursor-pointer"
                    aria-label="Augmenter la quantité"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Add / Added Button - Stays ON when in cart */}
                <button
                  type="button"
                  onClick={handleAdd}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer active:scale-95 ${
                    cartQuantity > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/40'
                      : 'bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white shadow-md'
                  }`}
                >
                  {cartQuantity > 0 ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        ✓ {t.addedToCart} (+{selectedQty}{isExtrait ? 'g' : ''})
                      </span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>{t.addToPreorder}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status indicator: remains ON until finishing order or save for later */}
              {cartQuantity > 0 && (
                <div className="flex items-center justify-between gap-2.5 text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-xl font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    <span>✓ {cartQuantity} {isExtrait ? 'g' : 'unités'} {t.inCart}</span>
                  </div>
                  
                  {onDecreaseCartQuantity && (
                    <button
                      type="button"
                      onClick={() => onDecreaseCartQuantity(product.id, isExtrait ? 100 : 1)}
                      className="px-2 py-1 text-[10px] font-black rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 hover:text-rose-950 border border-rose-200 hover:border-rose-300 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                      title={isExtrait ? "Retirer 100g" : "Retirer 1 unité"}
                    >
                      <Minus className="w-2.5 h-2.5 stroke-[3]" />
                      <span>
                        {lang === 'ar'
                          ? (isExtrait ? 'إزالة 100غ' : 'إزالة قطعة')
                          : (isExtrait ? 'Retirer 100g' : 'Retirer 1 unité')}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
