import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, ArrowRight, ShoppingBag, Check, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdBanner, Product } from '../types';

interface AdPopupModalProps {
  isOpen: boolean;
  onClose: (dontShowAgainToday?: boolean) => void;
  ad?: AdBanner | null;
  banner?: AdBanner | null;
  banners?: AdBanner[];
  products?: Product[];
  onAddToCart?: (product: Product, quantity: number) => void;
  onExploreClick?: (ad: AdBanner) => void;
  onExplore?: (ad: AdBanner) => void;
}

export const AdPopupModal: React.FC<AdPopupModalProps> = ({
  isOpen,
  onClose,
  ad: directAd,
  banner: directBanner,
  banners = [],
  products = [],
  onAddToCart,
  onExploreClick,
  onExplore,
}) => {
  // Consolidate list of banners
  const fallbackAd = directAd || directBanner || null;
  const bannersList: AdBanner[] = React.useMemo(() => {
    if (banners && banners.length > 0) return banners;
    return fallbackAd ? [fallbackAd] : [];
  }, [banners, fallbackAd]);

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [dontShowToday, setDontShowToday] = useState(false);
  const [addedProductIds, setAddedProductIds] = useState<string[]>([]);
  const [allAdded, setAllAdded] = useState(false);

  // Sync initial slide index to matched banner when opening
  useEffect(() => {
    if (fallbackAd && bannersList.length > 0) {
      const idx = bannersList.findIndex((b) => b.id === fallbackAd.id);
      if (idx !== -1) {
        setCurrentSlideIndex(idx);
      }
    }
  }, [fallbackAd, bannersList]);

  // Touch swipe support
  const touchStartXRef = useRef<number | null>(null);

  const handlePrevSlide = () => {
    if (bannersList.length <= 1) return;
    setSlideDirection(-1);
    setAllAdded(false);
    setCurrentSlideIndex((prev) => (prev === 0 ? bannersList.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    if (bannersList.length <= 1) return;
    setSlideDirection(1);
    setAllAdded(false);
    setCurrentSlideIndex((prev) => (prev === bannersList.length - 1 ? 0 : prev + 1));
  };

  // Keyboard navigation (ArrowLeft & ArrowRight to slide)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextSlide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, bannersList.length]);

  if (!isOpen || bannersList.length === 0) return null;

  const currentAd: AdBanner = bannersList[currentSlideIndex] || bannersList[0];

  // Resolve all target products for the current active ad (multi-product support)
  const targetProducts: Product[] = [];
  const candidateIds = [
    ...(currentAd.targetProductIds || []),
    ...(currentAd.targetProductId ? [currentAd.targetProductId] : []),
  ];

  candidateIds.forEach((id) => {
    const found = products.find((p) => p.id === id || p.code === id);
    if (found && !targetProducts.some((tp) => tp.id === found.id)) {
      targetProducts.push(found);
    }
  });

  const handleClose = () => {
    onClose(dontShowToday);
  };

  const handleAddSingleProduct = (prod: Product) => {
    if (!onAddToCart) return;
    const defaultQty = prod.family === 'Extrait' ? 100 : 1;
    onAddToCart(prod, defaultQty);
    setAddedProductIds((prev) => [...prev, prod.id]);
  };

  const handleAddAllProducts = () => {
    if (!onAddToCart || targetProducts.length === 0) return;
    targetProducts.forEach((prod) => {
      const defaultQty = prod.family === 'Extrait' ? 100 : 1;
      onAddToCart(prod, defaultQty);
    });
    setAddedProductIds(targetProducts.map((p) => p.id));
    setAllAdded(true);
    setTimeout(() => {
      handleClose();
    }, 1200);
  };

  const handleGeneralExplore = () => {
    if (onExploreClick) {
      onExploreClick(currentAd);
    } else if (onExplore) {
      onExplore(currentAd);
    }
    handleClose();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNextSlide(); // swiped left -> next
      } else {
        handlePrevSlide(); // swiped right -> prev
      }
    }
    touchStartXRef.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      id="ad-popup-modal-overlay"
    >
      <div className="relative max-w-lg w-full">
        {/* ANIMATED SLIDE TO LEFT BUTTON (Desktop/Tablet) */}
        {bannersList.length > 1 && (
          <motion.button
            type="button"
            onClick={handlePrevSlide}
            whileHover={{ scale: 1.15, x: -4 }}
            whileTap={{ scale: 0.9 }}
            className="hidden sm:flex absolute -left-5 lg:-left-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-slate-900/95 hover:bg-slate-900 text-amber-400 hover:text-amber-300 border-2 border-amber-500/70 hover:border-amber-400 shadow-2xl shadow-black/80 items-center justify-center cursor-pointer transition-colors backdrop-blur-sm group ring-2 ring-amber-500/20"
            aria-label="Publicité précédente"
            title="Glisser vers la gauche (Précédente • Touche Gauche)"
            id="ad-popup-slide-prev"
          >
            <ChevronLeft className="w-6 h-6 transition-transform duration-200 group-hover:-translate-x-1" />
          </motion.button>
        )}

        {/* ANIMATED SLIDE TO RIGHT BUTTON (Desktop/Tablet) */}
        {bannersList.length > 1 && (
          <motion.button
            type="button"
            onClick={handleNextSlide}
            whileHover={{ scale: 1.15, x: 4 }}
            whileTap={{ scale: 0.9 }}
            className="hidden sm:flex absolute -right-5 lg:-right-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-slate-900/95 hover:bg-slate-900 text-amber-400 hover:text-amber-300 border-2 border-amber-500/70 hover:border-amber-400 shadow-2xl shadow-black/80 items-center justify-center cursor-pointer transition-colors backdrop-blur-sm group ring-2 ring-amber-500/20"
            aria-label="Publicité suivante"
            title="Glisser vers la droite (Suivante • Touche Droite)"
            id="ad-popup-slide-next"
          >
            <ChevronRight className="w-6 h-6 transition-transform duration-200 group-hover:translate-x-1" />
          </motion.button>
        )}

        {/* Main Modal Card */}
        <div className="bg-gradient-to-b from-[#2a0416] via-[#1a020d] to-slate-950 border border-[#70083b]/70 rounded-2xl sm:rounded-3xl shadow-2xl w-full overflow-hidden relative text-white max-h-[92vh] flex flex-col">
          {/* Floating Close Button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 w-9 h-9 rounded-full bg-slate-950/80 hover:bg-slate-950 text-slate-300 hover:text-white border border-[#70083b]/60 flex items-center justify-center transition shadow-lg cursor-pointer"
            aria-label="Fermer"
            id="ad-popup-close-btn"
          >
            <X className="w-5 h-5" />
          </button>

          {/* SLIDER PAGINATION BADGE (when multiple popups exist) */}
          {bannersList.length > 1 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-[#2a0416]/90 backdrop-blur-md px-3 py-1 rounded-full border border-[#c2185b]/40 text-[11px] font-bold text-rose-200 flex items-center gap-1.5 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
              <span>
                Popup {currentSlideIndex + 1} / {bannersList.length}
              </span>
            </div>
          )}

          {/* SLIDE ANIMATED CONTENT CONTAINER */}
          <div className="overflow-hidden relative flex-1 flex flex-col">
            <AnimatePresence mode="wait" custom={slideDirection}>
              <motion.div
                key={currentAd.id || currentSlideIndex}
                custom={slideDirection}
                variants={{
                  enter: (dir: number) => ({
                    x: dir > 0 ? 80 : -80,
                    opacity: 0,
                  }),
                  center: {
                    x: 0,
                    opacity: 1,
                  },
                  exit: (dir: number) => ({
                    x: dir > 0 ? -80 : 80,
                    opacity: 0,
                  }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="flex flex-col flex-1"
              >
                {/* Ad Image Banner */}
                <div className="relative aspect-16/9 sm:aspect-16/8 w-full overflow-hidden bg-slate-950 shrink-0">
                  <img
                    src={currentAd.imageUrl}
                    alt={currentAd.title}
                    className="w-full h-full object-cover object-center"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/40" />

                  {/* Mobile Quick Slide Overlay Buttons */}
                  {bannersList.length > 1 && (
                    <div className="sm:hidden absolute inset-y-0 inset-x-2 flex items-center justify-between pointer-events-none z-20">
                      <motion.button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrevSlide();
                        }}
                        whileTap={{ scale: 0.85 }}
                        className="pointer-events-auto w-8 h-8 rounded-full bg-slate-950/80 text-rose-300 border border-rose-500/50 flex items-center justify-center shadow-lg"
                        aria-label="Précédent"
                        id="ad-popup-mobile-prev"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNextSlide();
                        }}
                        whileTap={{ scale: 0.85 }}
                        className="pointer-events-auto w-8 h-8 rounded-full bg-slate-950/80 text-rose-300 border border-rose-500/50 flex items-center justify-center shadow-lg"
                        aria-label="Suivant"
                        id="ad-popup-mobile-next"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </motion.button>
                    </div>
                  )}

                  {/* Corner Badge */}
                  {currentAd.badgeText && (
                    <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-gradient-to-r from-[#9f0e4e] to-[#c2185b] text-white font-black text-[10px] sm:text-xs tracking-wider uppercase shadow-lg border border-rose-300/40">
                      <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                      <span>{currentAd.badgeText}</span>
                    </div>
                  )}
                </div>

                {/* Ad Content */}
                <div className="p-4 sm:p-6 pt-3 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
                  <div>
                    <span className="text-[11px] font-bold text-rose-300 tracking-wider uppercase block mb-1">
                      Tulip Fragrance Company • Offre Exclusive
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white leading-snug">
                      {currentAd.title}
                    </h3>
                    {currentAd.subtitle && (
                      <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                        {currentAd.subtitle}
                      </p>
                    )}
                  </div>

                  {/* MULTI-PRODUCT SELECTION LIST */}
                  {targetProducts.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5 text-rose-400" />
                          Produits sélectionnés ({targetProducts.length}) :
                        </span>
                        {targetProducts.length > 1 && (
                          <span className="text-[11px] text-rose-300 font-semibold">
                            Ajout individuel ou groupé
                          </span>
                        )}
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {targetProducts.map((prod) => {
                          const isAdded = addedProductIds.includes(prod.id);
                          const hasDiscount = Boolean(prod.discountPercent && prod.discountPercent > 0);
                          const effectivePrice = hasDiscount
                            ? Math.round(prod.priceDA * (1 - (prod.discountPercent || 0) / 100))
                            : prod.priceDA;

                          return (
                            <div
                              key={prod.id}
                              className="bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-2.5 flex items-center justify-between gap-3 transition"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {prod.imageUrl ? (
                                  <img
                                    src={prod.imageUrl}
                                    alt={prod.name}
                                    className="w-11 h-11 rounded-xl object-cover border border-slate-800 shrink-0"
                                  />
                                ) : (
                                  <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                    <ShoppingBag className="w-5 h-5" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="text-white font-bold text-xs truncate">
                                    {prod.name}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span className="font-mono text-slate-300">{prod.code}</span>
                                    <span>•</span>
                                    <span className="text-rose-300 font-bold">
                                      {effectivePrice} DA {prod.family === 'Extrait' ? '/ 1g' : ''}
                                    </span>
                                    {hasDiscount && (
                                      <span className="text-rose-400 text-[10px] font-bold line-through">
                                        {prod.priceDA} DA
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-2">
                                {hasDiscount && (
                                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-black border border-rose-500/30">
                                    -{prod.discountPercent}%
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleAddSingleProduct(prod)}
                                  disabled={isAdded}
                                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm ${
                                    isAdded
                                      ? 'bg-emerald-600 text-white cursor-default'
                                      : 'bg-gradient-to-r from-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white'
                                  }`}
                                >
                                  {isAdded ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      <span>Ajouté</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                      <span>Ajouter</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Main Action Buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                    {targetProducts.length > 1 ? (
                      <button
                        type="button"
                        onClick={handleAddAllProducts}
                        disabled={allAdded}
                        className={`w-full sm:flex-1 py-3 px-4 rounded-xl text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition ${
                          allAdded
                            ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                            : 'bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 shadow-rose-950/40'
                        }`}
                      >
                        {allAdded ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Tous les produits ajoutés au bon !</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" />
                            <span>Ajouter Toute la Sélection ({targetProducts.length} articles)</span>
                          </>
                        )}
                      </button>
                    ) : targetProducts.length === 1 ? (
                      <button
                        type="button"
                        onClick={() => handleAddSingleProduct(targetProducts[0])}
                        disabled={addedProductIds.includes(targetProducts[0].id)}
                        className={`w-full sm:flex-1 py-3 px-4 rounded-xl text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition ${
                          addedProductIds.includes(targetProducts[0].id)
                            ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                            : 'bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 shadow-rose-950/40'
                        }`}
                      >
                        {addedProductIds.includes(targetProducts[0].id) ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Ajouté au panier !</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" />
                            <span>{currentAd.buttonText || 'Ajouter au Panier'}</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGeneralExplore}
                        className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 cursor-pointer transition"
                      >
                        <span>{currentAd.buttonText || 'Découvrir la Collection'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleClose}
                      className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
                    >
                      Fermer
                    </button>
                  </div>

                  {/* SLIDE NAVIGATION DOTS & COUNTER (when multiple popups exist) */}
                  {bannersList.length > 1 && (
                    <div className="pt-2 flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePrevSlide}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span className="hidden sm:inline text-[11px]">Précédent</span>
                        </button>

                        <div className="flex items-center gap-1.5 px-2">
                          {bannersList.map((b, idx) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                setSlideDirection(idx > currentSlideIndex ? 1 : -1);
                                setAllAdded(false);
                                setCurrentSlideIndex(idx);
                              }}
                              className={`transition-all duration-300 rounded-full cursor-pointer ${
                                idx === currentSlideIndex
                                  ? 'w-7 h-2.5 bg-gradient-to-r from-[#9f0e4e] to-[#c2185b] shadow-sm shadow-rose-500/50'
                                  : 'w-2.5 h-2.5 bg-slate-700 hover:bg-slate-500'
                              }`}
                              title={`Glisser vers: ${b.title}`}
                              id={`popup-dot-${idx}`}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={handleNextSlide}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <span className="hidden sm:inline text-[11px]">Suivant</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Checkbox: Don't show again today */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <label className="flex items-center gap-2 cursor-pointer select-none hover:text-slate-300">
                      <input
                        type="checkbox"
                        checked={dontShowToday}
                        onChange={(e) => setDontShowToday(e.target.checked)}
                        className="w-4 h-4 rounded-md border-slate-700 bg-slate-950 text-[#9f0e4e] focus:ring-[#9f0e4e] cursor-pointer"
                      />
                      <span>Ne plus afficher aujourd'hui</span>
                    </label>

                    <span className="text-slate-500">Matières premières d'Oran</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

