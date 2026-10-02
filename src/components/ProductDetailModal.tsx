import React, { useState, useEffect } from 'react';
import { X, Sparkles, Layers, Wrench, Package, MapPin, Check, Plus, Minus, XCircle, ShieldCheck, Lock, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product } from '../types';
import { formatDZD } from '../utils/pdfGenerator';
import { AppLanguage, translations } from '../translations';
import { getProductLocalizedDetails } from '../data/productTranslations';
import { calculateDiscountedPrice } from '../utils/productUtils';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  cartQuantity: number;
  onAddToCart: (product: Product, quantity: number) => void;
  isPricesVisible?: boolean;
  onRequireLogin?: () => void;
  lang?: AppLanguage;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  cartQuantity,
  onAddToCart,
  isPricesVisible = false,
  onRequireLogin,
  lang = 'ar',
  isFavorite = false,
  onToggleFavorite,
}) => {
  const t = translations[lang];
  const isRtl = false; // Layout stays LTR for accessibility and right-handed reachability
  const isExtrait = product?.family === 'Extrait';
  const localized = product ? getProductLocalizedDetails(product, lang) : null;

  const defaultInitialQty = isExtrait ? 100 : 1;
  const [selectedQty, setSelectedQty] = useState(defaultInitialQty);
  const [qtyInputValue, setQtyInputValue] = useState(String(defaultInitialQty));

  useEffect(() => {
    if (product) {
      const isExt = product.family === 'Extrait';
      const available = Math.max(0, product.stock - cartQuantity);
      const defaultQty = isExt ? Math.min(100, Math.max(1, available)) : 1;
      setSelectedQty(defaultQty);
      setQtyInputValue(String(defaultQty));
    }
  }, [product, cartQuantity]);

  // Handle escape key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!product || !localized) return null;

  const hasDiscount = Boolean(product.discountPercent && product.discountPercent > 0);
  const discountedPriceDA = calculateDiscountedPrice(product.priceDA, product.discountPercent);

  const availableStock = Math.max(0, product.stock - cartQuantity);
  const isOutOfStock = product.stock <= 0;
  const isAllInCart = availableStock <= 0 && product.stock > 0;
  const step = isExtrait ? 100 : 1;

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
      const fallback = Math.max(1, Math.min(availableStock > 0 ? availableStock : 1, defaultInitialQty));
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

  const handleAdd = () => {
    if (availableStock <= 0) return;
    const qty = Math.min(selectedQty, availableStock);
    onAddToCart(product, qty);
    const remaining = availableStock - qty;
    if (remaining > 0) {
      const nextDefault = isExtrait ? Math.min(100, remaining) : 1;
      setSelectedQty(nextDefault);
      setQtyInputValue(String(nextDefault));
    }
  };

  const calculatedTotalPrice = discountedPriceDA * selectedQty;
  const containersCount = isExtrait ? (selectedQty / 100).toFixed(selectedQty % 100 === 0 ? 0 : 1) : null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all"
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        id="product-detail-modal-backdrop"
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl max-w-xl md:max-w-2xl lg:max-w-3xl w-full max-h-[90dvh] sm:max-h-[85vh] flex flex-col md:flex-row overflow-hidden border border-slate-100 relative"
          onClick={(e) => e.stopPropagation()}
          id="product-detail-modal-container"
        >
          {/* Mobile Drag Indicator Handle */}
          <div className="md:hidden absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <div className="w-10 h-1 rounded-full bg-slate-300/80 shadow-xs" />
          </div>

          {/* Product Image: Tuned to mobile ratio (h-48 on mobile, aspect-[16/10] safe framing) */}
          <div className="w-full md:w-1/2 bg-slate-100 relative h-48 sm:h-56 md:h-auto md:min-h-[420px] shrink-0 overflow-hidden">
            <img
              src={
                product.imageUrl && !product.imageUrl.includes('photo-1608571423902')
                  ? product.imageUrl
                  : isExtrait
                  ? '/tulip-extrait-default.jpg'
                  : product.family === 'Accessoire'
                  ? 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600'
                  : (product.imageUrl || 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600')
              }
              alt={localized.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.onerror = null;
                target.src = '/tulip-extrait-default.jpg';
              }}
            />
            {/* Top gradient shadow for button contrast on bright product photography */}
            <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-slate-950/40 to-transparent pointer-events-none md:hidden" />

            {/* Badges: Family & Solde */}
            <div className={`absolute top-3 ${isRtl ? 'right-3' : 'left-3'} flex flex-col gap-1.5 items-start z-10`}>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5 shadow-sm ${
                  isExtrait
                    ? 'bg-amber-100/95 text-amber-900 border border-amber-300'
                    : product.family === 'Accessoire'
                    ? 'bg-teal-100/95 text-teal-900 border border-teal-300'
                    : 'bg-indigo-100/95 text-indigo-900 border border-indigo-300'
                }`}
              >
                {isExtrait ? (
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                ) : product.family === 'Accessoire' ? (
                  <Wrench className="w-3.5 h-3.5 text-teal-700" />
                ) : (
                  <Layers className="w-3.5 h-3.5 text-indigo-700" />
                )}
                {isExtrait
                  ? t.extraitsTitle.split(' ')[0]
                  : product.family === 'Accessoire'
                  ? (t.accessoriesTitle ? t.accessoriesTitle.split(' ')[0] : 'Accessoires')
                  : t.flaconsTitle.split(' ')[0]}
              </span>

              {/* Big Promo / Solde Sticker */}
              {hasDiscount && (
                <span className="px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-black bg-rose-600 text-white shadow-lg flex items-center gap-1.5 tracking-wider uppercase border-2 border-white animate-bounce">
                  <span>🔥 -{product.discountPercent}%</span>
                  <span>{t.soldeBadge}</span>
                </span>
              )}
            </div>

            {/* Mobile Top Controls: Close & Favorite */}
            <div className={`md:hidden absolute top-3 ${isRtl ? 'left-3' : 'right-3'} flex items-center gap-2 z-10`}>
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(product.id)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition cursor-pointer shadow-md ${
                    isFavorite
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-950/60 text-white hover:bg-slate-900'
                  }`}
                  title={isFavorite ? t.removeFromFavorites : t.addToFavorites}
                  aria-label={isFavorite ? t.removeFromFavorites : t.addToFavorites}
                  id="mobile-modal-favorite-btn"
                >
                  <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-950/60 text-white hover:bg-slate-900 transition cursor-pointer shadow-md"
                aria-label="Fermer"
                id="mobile-modal-close-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: Product Information & Controls */}
          <div className="w-full md:w-1/2 flex flex-col flex-1 overflow-hidden">
            {/* Scrollable details body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 sm:space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[11px] sm:text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium border border-slate-200">
                    {product.code}
                  </span>
                  <h3 className="text-base sm:text-xl font-black text-slate-900 mt-1 leading-snug">
                    {localized.name}
                  </h3>
                </div>
                <div className="hidden md:flex items-center gap-1.5 shrink-0">
                  {onToggleFavorite && (
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(product.id)}
                      className={`p-2 rounded-lg transition cursor-pointer border ${
                        isFavorite
                          ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                          : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50/50 border-transparent'
                      }`}
                      title={isFavorite ? t.removeFromFavorites : t.addToFavorites}
                      id="desktop-modal-favorite-btn"
                    >
                      <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                    aria-label="Fermer"
                    id="desktop-modal-close-btn"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Badges / Specs & Stock */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium flex items-center gap-1 border border-slate-200">
                  <Package className="w-3.5 h-3.5 text-slate-500" />
                  {isExtrait ? '1g (Flacon scellé 100g)' : product.unit}
                </span>
                {localized.origin && (
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium flex items-center gap-1 border border-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {localized.origin}
                  </span>
                )}
                {isOutOfStock ? (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    {t.filterOutOfStock}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    {t.filterInStock}
                  </div>
                )}
              </div>

              {/* Extrait Container Callout */}
              {isExtrait && (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>{t.container100g}</span>
                    <span className="text-amber-800 font-bold">
                      {isPricesVisible ? (
                        `${formatDZD(discountedPriceDA * 100)} / flacon`
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                          <Lock className="w-3 h-3" /> {t.confidentialPriceBadge}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Localized Description */}
              <div className="text-xs text-slate-600 leading-relaxed space-y-1 border-t border-slate-100 pt-2.5">
                <h4 className="font-bold text-slate-900 text-xs">
                  {lang === 'ar' ? 'بطاقة المنتج الوصفية:' : lang === 'en' ? 'Product Description:' : 'Fiche Matière Première :'}
                </h4>
                <p className="text-slate-600">{localized.description}</p>
              </div>
            </div>

            {/* Bottom Action Bar: Price, Presets, Quantity, and Add to Preorder */}
            <div className="p-4 sm:p-6 pt-3 border-t border-slate-200 bg-slate-50/70 sm:bg-white shrink-0">
              {!isPricesVisible ? (
                <div className="mb-2.5 p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-[11px] sm:text-xs">{t.priceHiddenNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequireLogin?.();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 cursor-pointer shadow-xs transition"
                    id="modal-login-btn"
                  >
                    {t.loginBtn}
                  </button>
                </div>
              ) : (
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <span className="text-[11px] text-slate-500 block">
                      {isExtrait ? t.perGram : t.perPiece}
                    </span>
                    {hasDiscount ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-black text-rose-600">
                          {formatDZD(discountedPriceDA)}
                        </span>
                        <span className="text-xs text-slate-400 line-through">
                          {formatDZD(product.priceDA)}
                        </span>
                        {isExtrait && <span className="text-xs font-bold text-rose-700">/ 1g</span>}
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl sm:text-2xl font-black text-slate-950">
                          {formatDZD(product.priceDA)}
                        </span>
                        {isExtrait && <span className="text-xs font-bold text-[#880e4f]">/ 1g</span>}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] sm:text-[11px] text-slate-500 block">Total sélectionné :</span>
                    <span className="text-sm sm:text-base font-black text-slate-900">
                      {formatDZD(calculatedTotalPrice)}
                    </span>
                    {isExtrait && (
                      <span className="block text-[10px] text-slate-500">
                        ({selectedQty}g ~ {containersCount} fl.)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Presets for Extrait */}
              {isExtrait && !isOutOfStock && !isAllInCart && (
                <div className="flex items-center gap-1.5 mb-2.5 text-xs overflow-x-auto pb-0.5">
                  <span className="text-slate-500 font-semibold text-[11px] shrink-0">Presets :</span>
                  {[100, 200, 300, 500].map((presetG) => {
                    if (presetG > availableStock) return null;
                    return (
                      <button
                        key={presetG}
                        type="button"
                        onClick={() => {
                          setSelectedQty(presetG);
                          setQtyInputValue(String(presetG));
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer shrink-0 ${
                          selectedQty === presetG
                            ? 'bg-[#9f0e4e] text-white border-[#70083b] shadow-xs'
                            : 'bg-rose-50/60 text-slate-700 border-rose-200/80 hover:bg-rose-100/60'
                        }`}
                        id={`modal-preset-${presetG}g`}
                      >
                        {presetG}g
                      </button>
                    );
                  })}
                </div>
              )}

              {isOutOfStock ? (
                <button
                  disabled
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs cursor-not-allowed text-center border border-slate-200"
                  id="modal-out-of-stock-btn"
                >
                  {t.outOfStock}
                </button>
              ) : isAllInCart ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-2 px-3 text-center text-xs font-bold text-emerald-900">
                  ✓ Tout le stock disponible est dans votre bon ({cartQuantity}{isExtrait ? 'g' : ''})
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-rose-200/90 rounded-xl bg-rose-50/40 p-1 shrink-0 shadow-inner">
                      <button
                        type="button"
                        onClick={decrement}
                        disabled={selectedQty <= 1}
                        className="p-1.5 text-slate-600 hover:bg-rose-100/70 rounded-lg disabled:opacity-40 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                        aria-label="Diminuer la quantité"
                        id="modal-qty-decrement"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <div className="px-1.5 flex items-center">
                        <input
                          type="number"
                          min={1}
                          max={availableStock}
                          value={qtyInputValue}
                          onChange={handleQtyChange}
                          onBlur={handleBlur}
                          className="w-12 sm:w-14 text-center text-xs font-bold text-slate-900 bg-transparent focus:outline-hidden"
                          id="modal-qty-input"
                        />
                        <span className="text-[11px] text-[#880e4f] font-bold">{isExtrait ? 'g' : 'u'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={increment}
                        disabled={selectedQty >= availableStock}
                        className="p-1.5 text-slate-600 hover:bg-rose-100/70 rounded-lg disabled:opacity-40 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                        aria-label="Augmenter la quantité"
                        id="modal-qty-increment"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleAdd}
                      className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition shadow-md cursor-pointer ${
                        cartQuantity > 0
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white'
                      }`}
                      id="modal-add-to-cart-btn"
                    >
                      {cartQuantity > 0 ? (
                        <>
                          <Check className="w-4 h-4 shrink-0" />
                          <span className="truncate">✓ {t.addedToCart} (+{selectedQty}{isExtrait ? 'g' : ''})</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 shrink-0" />
                          <span className="truncate">{t.addToPreorder}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] text-slate-500 pt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Réservation sans avance • Paiement à la réception</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

