import React, { useState, useEffect } from 'react';
import { X, Sparkles, Layers, Wrench, Package, MapPin, Check, Plus, Minus, XCircle, ShieldCheck, Lock, Heart, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OffersConfig, Product } from '../types';
import { formatDZD } from '../utils/formatDZD';
import { AppLanguage, translations } from '../translations';
import { getProductLocalizedDetails } from '../data/productTranslations';
import { calculateDiscountedPrice, isProductTopSeller, normalizeGender } from '../utils/productUtils';
import { effectiveTiers, getUnitPrice, resolveVolumeTier, volumeNudge } from '../utils/offers';

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
  offers?: OffersConfig | null;
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
  offers = null,
}) => {
  const t = translations[lang];
  const isRtl = false; // Layout stays LTR for accessibility and right-handed reachability
  const isExtrait = product?.family === 'Extrait';
  const localized = product ? getProductLocalizedDetails(product, lang) : null;

  const defaultInitialQty = isExtrait ? 100 : 1;
  const [selectedQty, setSelectedQty] = useState(defaultInitialQty);
  const [qtyInputValue, setQtyInputValue] = useState(String(defaultInitialQty));

  // Zoom & Lightbox State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [touchStartZoom, setTouchStartZoom] = useState(1);
  const [lastTapTime, setLastTapTime] = useState(0);

  // In-place hover zoom position on card
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMoveImage = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (lightboxZoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  };

  const handleMouseMoveLightbox = (e: React.MouseEvent) => {
    if (!isDragging || lightboxZoom <= 1) return;
    setPanPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setLightboxZoom((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))));
    } else {
      setLightboxZoom((prev) => {
        const next = Math.max(1, Number((prev - 0.25).toFixed(2)));
        if (next === 1) setPanPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const handleDoubleClick = () => {
    if (lightboxZoom > 1.2) {
      setLightboxZoom(1);
      setPanPosition({ x: 0, y: 0 });
    } else {
      setLightboxZoom(2.5);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchStartDist(dist);
      setTouchStartZoom(lightboxZoom);
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapTime < 300) {
        if (lightboxZoom > 1.2) {
          setLightboxZoom(1);
          setPanPosition({ x: 0, y: 0 });
        } else {
          setLightboxZoom(2.5);
        }
        setLastTapTime(0);
        return;
      }
      setLastTapTime(now);
      if (lightboxZoom > 1) {
        setIsDragging(true);
        setDragStart({ x: e.touches[0].clientX - panPosition.x, y: e.touches[0].clientY - panPosition.y });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartDist;
      const newZoom = Math.min(4, Math.max(1, Number((touchStartZoom * ratio).toFixed(2))));
      setLightboxZoom(newZoom);
    } else if (e.touches.length === 1 && isDragging && lightboxZoom > 1) {
      setPanPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setTouchStartDist(null);
    setIsDragging(false);
  };

  useEffect(() => {
    if (product) {
      const isExt = product.family === 'Extrait';
      const available = Math.max(0, product.stock - cartQuantity);
      const defaultQty = isExt ? Math.min(100, Math.max(1, available)) : 1;
      setSelectedQty(defaultQty);
      setQtyInputValue(String(defaultQty));
    }
  }, [product, cartQuantity]);

  // Reset zoom and lightbox when product changes
  useEffect(() => {
    setIsLightboxOpen(false);
    setLightboxZoom(1);
    setPanPosition({ x: 0, y: 0 });
    setIsHoveringImage(false);
  }, [product?.id]);

  // Handle escape key to dismiss lightbox first, or modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLightboxOpen) {
          setIsLightboxOpen(false);
          setLightboxZoom(1);
          setPanPosition({ x: 0, y: 0 });
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isLightboxOpen]);

  // Handle phone navigation back button specifically for fullscreen lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    try {
      window.history.pushState({ tulipLightbox: true }, '');
    } catch (e) {
      console.error(e);
    }

    const handlePopState = () => {
      setIsLightboxOpen(false);
      setLightboxZoom(1);
      setPanPosition({ x: 0, y: 0 });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isLightboxOpen]);

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

  // Volume pricing: unit price follows the quantity chosen
  const unitPriceDA = getUnitPrice(product, selectedQty, offers);
  const tiers = effectiveTiers(product, offers);
  const appliedTier = resolveVolumeTier(product, selectedQty, offers).applied;
  const nudge = isPricesVisible ? volumeNudge(product, selectedQty, offers) : null;
  const calculatedTotalPrice = unitPriceDA * selectedQty;
  const containersCount = isExtrait ? (selectedQty / 100).toFixed(selectedQty % 100 === 0 ? 0 : 1) : null;

  const gKey = normalizeGender(product.gender);
  const genderChip = gKey === 'men' ? 'Homme' : gKey === 'women' ? 'Femme' : gKey === 'unisex' ? 'Mixte' : '';
  const olf = product.olfactive;
  const olfactiveCard = olf ? (
    <div className="bg-white border border-rose-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {lang === 'ar' ? 'البطاقة العطرية' : lang === 'en' ? 'Fragrance profile' : 'Fiche olfactive'}
        </h4>
        {olf.suggested && (
          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 rounded-full px-2.5 py-1 whitespace-nowrap">
            {lang === 'en' ? 'Season and time: suggestion' : 'Saison et moment : suggestion'}
          </span>
        )}
      </div>
      {(olf.top || olf.middle || olf.base) ? (
        <div className="grid grid-cols-3 gap-2 text-xs leading-snug">
          {[
            [lang === 'en' ? 'TOP' : 'TÊTE', olf.top],
            [lang === 'en' ? 'HEART' : 'CŒUR', olf.middle],
            [lang === 'en' ? 'BASE' : 'FOND', olf.base],
          ].map(([label, val]) => (
            <div key={label as string} className="bg-[#fdf6f8] rounded-xl p-2.5">
              <div className="text-[10px] font-black tracking-wider text-[#9f0e4e]">{label}</div>
              <div className="text-slate-700 mt-1">{(val as string) || '—'}</div>
            </div>
          ))}
        </div>
      ) : olf.notes ? (
        <div className="text-xs text-slate-700">{olf.notes}</div>
      ) : null}
      {olf.accords && (
        <div>
          <div className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase">{lang === 'en' ? 'Main accords' : 'Accords principaux'}</div>
          <div className="flex flex-wrap gap-1.5">
            {olf.accords.split(',').map((a) => a.trim()).filter(Boolean).map((a) => (
              <span key={a} className="text-xs font-semibold text-[#9f0e4e] bg-rose-100 rounded-full px-3 py-1">{a}</span>
            ))}
          </div>
        </div>
      )}
      {(olf.season || olf.time) && (
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
          {olf.season && <span className="border border-rose-200 rounded-xl px-3 py-1.5">❄ {olf.season}</span>}
          {olf.time && <span className="border border-rose-200 rounded-xl px-3 py-1.5">☾ {olf.time}</span>}
        </div>
      )}
      {olf.description && <p className="text-xs text-slate-600 leading-relaxed">{olf.description}</p>}
    </div>
  ) : null;

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
          className="bg-white rounded-t-[28px] md:rounded-[28px] shadow-2xl max-w-xl md:max-w-5xl w-full max-h-[94dvh] md:max-h-[92vh] flex flex-col md:flex-row overflow-y-auto md:overflow-hidden border border-rose-100 relative"
          onClick={(e) => e.stopPropagation()}
          id="product-detail-modal-container"
        >
          {/* Left column: single picture + fragrance profile (desktop) */}
          <div className="w-full md:w-[42%] shrink-0 bg-[#fdf6f8] md:border-r border-rose-100 p-4 md:p-6 flex flex-col gap-4 md:overflow-y-auto">
            <div
              className="relative rounded-2xl bg-gradient-to-br from-rose-100 to-rose-200/70 h-64 md:h-[26rem] shrink-0 flex items-center justify-center overflow-hidden cursor-zoom-in group select-none"
              onMouseEnter={() => setIsHoveringImage(true)}
              onMouseLeave={() => setIsHoveringImage(false)}
              onMouseMove={handleMouseMoveImage}
              onClick={() => setIsLightboxOpen(true)}
              title="Cliquer pour agrandir et zoomer en plein écran"
            >
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
                className="max-w-full max-h-full w-auto h-auto object-contain transition-transform duration-200 ease-out will-change-transform drop-shadow-sm"
                style={{
                  transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
                  transform: isHoveringImage ? 'scale(1.8)' : 'scale(1)',
                }}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.onerror = null;
                  target.src = '/tulip-extrait-default.jpg';
                }}
              />

              <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start z-10">
                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-[#9f0e4e] text-white tracking-wide">
                  {isExtrait
                    ? 'EXTRAIT 100% PUR'
                    : product.family === 'Accessoire'
                    ? (t.accessoriesTitle ? t.accessoriesTitle.split(' ')[0] : 'Accessoires').toUpperCase()
                    : t.flaconsTitle.split(' ')[0].toUpperCase()}
                </span>
                {hasDiscount && (
                  <span className="px-3 py-1 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-md border-2 border-white">
                    🔥 -{product.discountPercent}% {t.soldeBadge}
                  </span>
                )}
              </div>

              {/* Favorite + (mobile) close */}
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(product.id);
                    }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer shadow-sm ${
                      isFavorite ? 'bg-rose-500 text-white' : 'bg-white text-[#9f0e4e] hover:bg-rose-50'
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="md:hidden w-9 h-9 rounded-full flex items-center justify-center bg-white text-slate-700 shadow-sm cursor-pointer"
                  aria-label="Fermer"
                  id="mobile-modal-close-btn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <span className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-xl bg-slate-950/75 text-white text-[11px] font-bold flex items-center gap-1.5 pointer-events-none">
                <ZoomIn className="w-3.5 h-3.5 text-pink-300" /> Zoom HD
              </span>
            </div>

            <div className="hidden md:block">{olfactiveCard}</div>
          </div>

          {/* Right column: info, prices, format, quantity */}
          <div className="flex-1 min-w-0 flex flex-col md:min-h-0 md:overflow-hidden">
            <div className="p-4 md:p-8 md:pb-4 space-y-4 md:overflow-y-auto md:flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-mono">RÉF. {product.code}</span>
                  {isProductTopSeller(product) && (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-[#9f0e4e] uppercase">
                      {product.style === 'Niche' ? 'Best-seller niche' : 'Best-seller'}
                    </span>
                  )}
                  {genderChip && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">{genderChip}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="hidden md:flex w-9 h-9 shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 items-center justify-center text-slate-600 cursor-pointer"
                  aria-label="Fermer"
                  id="desktop-modal-close-btn"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <h3
                  className="text-3xl md:text-4xl font-bold text-[#9f0e4e] leading-tight"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {localized.name}
                </h3>
                {product.brand && (
                  <div className="text-sm text-slate-600 mt-1.5">
                    {lang === 'en' ? 'Inspired by' : 'Inspiration olfactive de prestige'} : <strong className="text-slate-900">{product.brand}</strong>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="px-3 py-1.5 rounded-full border border-rose-200 text-slate-700 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-slate-500" />
                  {isExtrait ? '1g (Flacon scellé 100g)' : product.unit}
                </span>
                {localized.origin && (
                  <span className="px-3 py-1.5 rounded-full border border-rose-200 text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {localized.origin}
                  </span>
                )}
                {isOutOfStock ? (
                  <span className="px-3 py-1.5 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {t.filterOutOfStock}
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    {t.filterInStock}
                  </span>
                )}
              </div>

              {!isPricesVisible ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{t.priceHiddenNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequireLogin?.();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 cursor-pointer"
                    id="modal-login-btn"
                  >
                    {t.loginBtn}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3 pt-1">
                    <span className="text-xs text-slate-500">
                      {tiers.length > 0 ? 'Tarif pro B2B, dégressif' : isExtrait ? t.perGram : t.perPiece}
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-3xl font-extrabold ${hasDiscount ? 'text-rose-600' : 'text-[#9f0e4e]'}`}>
                        {formatDZD(unitPriceDA)}
                      </span>
                      {hasDiscount && <span className="text-xs text-slate-400 line-through">{formatDZD(product.priceDA)}</span>}
                      <span className="text-sm text-slate-500">{isExtrait ? '/ g' : '/ u'}</span>
                    </div>
                  </div>

                  {tiers.length > 0 && (
                    <div className="grid grid-cols-3 gap-2.5">
                      {[{ minQty: 1, priceDA: 0 }, ...tiers.slice(0, 2)].map((tier, i, arr) => {
                        const nextT = arr[i + 1];
                        const on = appliedTier ? appliedTier.minQty === tier.minQty : i === 0;
                        const unit = getUnitPrice(product, tier.minQty, offers);
                        const baseUnit = getUnitPrice(product, 1, offers);
                        const u = isExtrait ? 'g' : '';
                        const label = i === 0
                          ? (nextT ? `${isExtrait ? '100' : '1'}${u} – ${nextT.minQty - 1}${u}` : `1${u}+`)
                          : nextT
                          ? `${tier.minQty}${u} – ${nextT.minQty - 1}${u}`
                          : `${tier.minQty}${u} ${lang === 'en' ? '+' : 'et plus'}`;
                        return (
                          <button
                            key={tier.minQty}
                            type="button"
                            onClick={() => {
                              const q = Math.min(availableStock > 0 ? availableStock : tier.minQty, Math.max(1, i === 0 && isExtrait ? 100 : tier.minQty));
                              setSelectedQty(q);
                              setQtyInputValue(String(q));
                            }}
                            className={`rounded-2xl p-3 text-left cursor-pointer transition ${
                              on ? 'border-2 border-[#9f0e4e] bg-rose-50' : 'border border-rose-200 bg-white hover:border-rose-300'
                            }`}
                          >
                            <div className="text-[11px] font-bold text-slate-600">{label}</div>
                            <div className="text-base font-extrabold text-slate-900 mt-0.5">{formatDZD(unit)}</div>
                            <div className={`text-[11px] ${i === 0 ? 'text-slate-500' : 'text-emerald-700'}`}>
                              {i === 0 ? (lang === 'en' ? 'Standard rate' : 'Tarif standard') : `−${Math.max(0, Math.round((baseUnit - unit) * 100) / 100).toLocaleString('fr-FR')} DA / ${isExtrait ? 'g' : 'u'}`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              <div className="md:hidden">{olfactiveCard}</div>

              {isPricesVisible && isExtrait && !isOutOfStock && !isAllInCart && (
                <div className="border-t border-rose-100 pt-4">
                  <div className="text-xs font-black tracking-wider text-[#9f0e4e] mb-2.5">1. {lang === 'en' ? 'SEALED FORMAT' : 'FORMAT SCELLÉ'}</div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { g: 100, sub: lang === 'en' ? 'Sample / tester' : 'Échantillon / testeur' },
                      { g: 500, sub: lang === 'en' ? 'Half-kilo drum' : 'Bidon demi-kilo' },
                      { g: 1000, sub: lang === 'en' ? 'Original alu drum' : "Bidon alu d'origine" },
                    ].map((f) => {
                      if (f.g > availableStock) return null;
                      const on = selectedQty === f.g;
                      return (
                        <button
                          key={f.g}
                          type="button"
                          onClick={() => {
                            setSelectedQty(f.g);
                            setQtyInputValue(String(f.g));
                          }}
                          className={`rounded-2xl p-3 text-left cursor-pointer transition ${
                            on ? 'border-2 border-[#9f0e4e] bg-rose-50' : 'border border-rose-200 bg-white hover:border-rose-300'
                          }`}
                          id={`modal-preset-${f.g}g`}
                        >
                          <div className="text-base font-extrabold text-slate-900">{f.g === 1000 ? '1 000 g' : `${f.g} g`}</div>
                          <div className="text-[11px] text-slate-500 leading-tight">{f.sub}</div>
                          <div className="text-xs font-bold text-slate-800 mt-1">{formatDZD(getUnitPrice(product, f.g, offers) * f.g)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!isOutOfStock && !isAllInCart && (
                <div className={isExtrait && isPricesVisible ? '' : 'border-t border-rose-100 pt-4'}>
                  <div className="text-xs font-black tracking-wider text-[#9f0e4e] mb-2.5">
                    {isExtrait && isPricesVisible ? '2. ' : ''}
                    {lang === 'en' ? 'QUANTITY' : 'QUANTITÉ'}
                    {isExtrait ? (lang === 'en' ? ' (STEPS OF 100 G)' : ' (PAR PAS DE 100 G)') : ''}
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center justify-between border border-rose-200 rounded-2xl p-1.5 w-full sm:w-64 bg-white">
                      <button
                        type="button"
                        onClick={decrement}
                        disabled={selectedQty <= 1}
                        className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center disabled:opacity-40 cursor-pointer"
                        aria-label="Diminuer la quantité"
                        id="modal-qty-decrement"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="flex items-baseline justify-center">
                        <input
                          type="number"
                          min={1}
                          max={availableStock}
                          value={qtyInputValue}
                          onChange={handleQtyChange}
                          onBlur={handleBlur}
                          className="w-16 text-center text-xl font-extrabold text-slate-900 bg-transparent focus:outline-hidden"
                          id="modal-qty-input"
                        />
                        <span className="text-sm font-bold text-slate-500">{isExtrait ? 'g' : 'u'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={increment}
                        disabled={selectedQty >= availableStock}
                        className="w-11 h-11 rounded-xl bg-[#9f0e4e] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                        aria-label="Augmenter la quantité"
                        id="modal-qty-increment"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {isExtrait &&
                      [200, 500].map((add) => (
                        <button
                          key={add}
                          type="button"
                          disabled={selectedQty + add > availableStock}
                          onClick={() => {
                            const q = Math.min(availableStock, selectedQty + add);
                            setSelectedQty(q);
                            setQtyInputValue(String(q));
                          }}
                          className="px-3 py-2.5 rounded-xl border border-rose-200 text-xs font-bold text-slate-600 hover:border-[#9f0e4e] disabled:opacity-40 cursor-pointer"
                        >
                          +{add} g
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {nudge && !isOutOfStock && !isAllInCart && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs sm:text-[13px] text-emerald-900">
                  <span aria-hidden="true">💡</span>
                  <span className="flex-1">
                    <strong>{lang === 'ar' ? 'نصيحة:' : lang === 'en' ? 'Tip:' : 'Conseil :'}</strong>{' '}
                    {lang === 'en'
                      ? `add ${nudge.missing}${isExtrait ? ' g' : ''} to save ${formatDZD(nudge.savingDA)}.`
                      : `ajoutez ${nudge.missing}${isExtrait ? ' g' : ''} pour économiser ${formatDZD(nudge.savingDA)}.`}
                  </span>
                  {availableStock >= nudge.minQty && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedQty(nudge.minQty);
                        setQtyInputValue(String(nudge.minQty));
                      }}
                      className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white cursor-pointer hover:bg-emerald-700"
                    >
                      {lang === 'en' ? `Go to ${nudge.minQty}` : `Passer à ${nudge.minQty}`}
                    </button>
                  )}
                </div>
              )}

              {localized.description && (
                <div className="text-xs text-slate-600 leading-relaxed border-t border-rose-100 pt-3">
                  <h4 className="font-bold text-slate-900 mb-1">
                    {lang === 'ar' ? 'بطاقة المنتج الوصفية:' : lang === 'en' ? 'Product Description:' : 'Fiche Matière Première :'}
                  </h4>
                  <p>{localized.description}</p>
                </div>
              )}
            </div>

            {/* Total + add to preorder (sticky on mobile) */}
            <div className="sticky bottom-0 md:static shrink-0 bg-white md:bg-[#fdf6f8] border-t border-rose-100 md:border-0 md:m-8 md:mt-0 md:rounded-2xl p-4 md:p-4 space-y-2.5 shadow-[0_-6px_20px_rgba(112,8,59,0.08)] md:shadow-none">
              {isPricesVisible && !isOutOfStock && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs md:text-sm text-slate-600">
                    {lang === 'en' ? 'Subtotal excl. tax' : 'Sous-total HT'}
                    {isExtrait && <span className="text-slate-400"> · {selectedQty} g (~{containersCount} fl.)</span>}
                  </span>
                  <span className="text-xl md:text-2xl font-extrabold text-[#9f0e4e]">{formatDZD(calculatedTotalPrice)}</span>
                </div>
              )}
              {isOutOfStock ? (
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-xl bg-slate-100 text-slate-400 font-bold text-sm cursor-not-allowed text-center border border-slate-200"
                  id="modal-out-of-stock-btn"
                >
                  {t.outOfStock}
                </button>
              ) : isAllInCart ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-2.5 px-3 text-center text-xs font-bold text-emerald-900">
                  ✓ Tout le stock disponible est dans votre bon ({cartQuantity}{isExtrait ? 'g' : ''})
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleAdd}
                    className={`w-full py-3.5 px-4 rounded-2xl font-extrabold text-sm md:text-[15px] flex items-center justify-center gap-2 transition shadow-md cursor-pointer text-white ${
                      cartQuantity > 0
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-gradient-to-r from-[#70083b] to-[#9f0e4e] hover:opacity-95'
                    }`}
                    id="modal-add-to-cart-btn"
                  >
                    {cartQuantity > 0 ? (
                      <>
                        <Check className="w-4 h-4 shrink-0" />
                        <span className="truncate">✓ {t.addedToCart} (+{selectedQty}{isExtrait ? 'g' : ''})</span>
                      </>
                    ) : (
                      <span className="truncate">{t.addToPreorder}</span>
                    )}
                  </button>
                  <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Réservation sans avance • Paiement à la réception</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Fullscreen HD Zoom Lightbox */}
        {isLightboxOpen && (
          <div
            className="fixed inset-0 z-[70] bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 select-none"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsLightboxOpen(false);
                setLightboxZoom(1);
                setPanPosition({ x: 0, y: 0 });
              }
            }}
            id="product-lightbox-modal"
          >
            {/* Top Toolbar */}
            <div className="flex items-center justify-between gap-3 w-full max-w-4xl mx-auto z-20 bg-slate-900/85 border border-white/15 rounded-2xl px-4 py-2.5 backdrop-blur-md shadow-2xl">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[11px] sm:text-xs bg-white/10 text-pink-300 px-2 py-0.5 rounded font-bold">
                  {product.code}
                </span>
                <span className="text-white text-xs sm:text-sm font-bold truncate max-w-[160px] sm:max-w-md">
                  {localized.name}
                </span>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLightboxZoom((prev) => {
                      const next = Math.max(1, Number((prev - 0.5).toFixed(1)));
                      if (next === 1) setPanPosition({ x: 0, y: 0 });
                      return next;
                    });
                  }}
                  disabled={lightboxZoom <= 1}
                  className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition cursor-pointer"
                  title="Dézoomer"
                  aria-label="Dézoomer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <span className="text-xs font-mono font-bold text-pink-200 px-2 py-1 bg-white/10 rounded-lg min-w-[50px] text-center">
                  {Math.round(lightboxZoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setLightboxZoom((prev) => Math.min(4, Number((prev + 0.5).toFixed(1))));
                  }}
                  disabled={lightboxZoom >= 4}
                  className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition cursor-pointer"
                  title="Zoomer"
                  aria-label="Zoomer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLightboxZoom(1);
                    setPanPosition({ x: 0, y: 0 });
                  }}
                  className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  title="Réinitialiser le zoom (100%)"
                  aria-label="Réinitialiser le zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsLightboxOpen(false);
                    setLightboxZoom(1);
                    setPanPosition({ x: 0, y: 0 });
                  }}
                  className="p-1.5 sm:p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer ml-1 sm:ml-2 shadow-md"
                  title="Fermer le zoom"
                  aria-label="Fermer le zoom"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Central Zoom Canvas */}
            <div
              className={`flex-1 flex items-center justify-center overflow-hidden w-full h-full my-2 relative touch-none ${
                lightboxZoom > 1
                  ? isDragging
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
                  : 'cursor-zoom-in'
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMoveLightbox}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onDoubleClick={handleDoubleClick}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${lightboxZoom})`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                }}
              >
                <img
                  src={
                    product.imageUrl && !product.imageUrl.includes('photo-1608571423902')
                      ? product.imageUrl
                      : isExtrait
                      ? '/tulip-extrait-default.jpg'
                      : product.family === 'Accessoire'
                      ? 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1200'
                      : (product.imageUrl || 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=1200')
                  }
                  alt={localized.name}
                  className="max-h-[75vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl pointer-events-none select-none border border-white/10"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.onerror = null;
                    target.src = '/tulip-extrait-default.jpg';
                  }}
                />
              </div>
            </div>

            {/* Bottom Helper Bar */}
            <div className="w-full max-w-md mx-auto text-center z-20 pb-2">
              <span className="text-[11px] sm:text-xs text-white/80 bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 shadow-md inline-block">
                Double-cliquez ou pincez l'écran pour zoomer • Molette ou glissez pour naviguer
              </span>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
};

