import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Sparkles,
  Layers,
  Wrench,
  Plus,
  Minus,
  Check,
  Package,
  Lock,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Heart,
  Flame,
} from 'lucide-react';
import { Product, ProductFamily, CartItem, OffersConfig } from '../types';
import { getUnitPrice, volumeNudge } from '../utils/offers';
import { formatDZD } from '../utils/formatDZD';
import { AppLanguage, translations } from '../translations';
import { getProductLocalizedDetails } from '../data/productTranslations';
import { isProductTopSeller, calculateDiscountedPrice, normalizeGender, type GenderKey } from '../utils/productUtils';
import { BrandGenderFilters } from './BrandGenderFilters';

interface QuickOrderViewProps {
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product, quantity: number) => void;
  onUpdateCartQuantity: (productId: string, newQty: number) => void;
  onDecreaseCartQuantity?: (productId: string, quantityToDecrease: number) => void;
  onOpenCart: () => void;
  onQuickView: (product: Product) => void;
  onSwitchToShowroom?: () => void;
  isPricesVisible?: boolean;
  onRequireLogin?: () => void;
  lang?: AppLanguage;
  selectedFamily?: ProductFamily | 'all';
  onSelectFamily?: (fam: ProductFamily | 'all') => void;
  favorites?: string[];
  onToggleFavorite?: (productId: string) => void;
  isLoading?: boolean;
  offers?: OffersConfig | null;
  // Gender / brand / sale filters (shared with the catalogue)
  genderFilter?: GenderKey | 'all';
  onSelectGender?: (g: GenderKey | 'all') => void;
  genderCounts?: { men: number; women: number; unisex: number };
  brandOptions?: { name: string; count: number }[];
  selectedBrands?: string[];
  onToggleBrand?: (brand: string) => void;
  showOnlyClearance?: boolean;
  onToggleOnlyClearance?: () => void;
  clearanceCount?: number;
}

export const QuickOrderView: React.FC<QuickOrderViewProps> = ({
  products,
  cart,
  onAddToCart,
  onUpdateCartQuantity,
  onDecreaseCartQuantity,
  onOpenCart,
  onQuickView,
  isPricesVisible = false,
  onRequireLogin,
  lang = 'ar',
  selectedFamily: propFamily,
  onSelectFamily: propOnSelectFamily,
  favorites = [],
  onToggleFavorite,
  offers = null,
  isLoading = false,
  genderFilter = 'all',
  onSelectGender,
  genderCounts = { men: 0, women: 0, unisex: 0 },
  brandOptions = [],
  selectedBrands = [],
  onToggleBrand,
  showOnlyClearance = false,
  onToggleOnlyClearance,
  clearanceCount = 0,
}) => {
  const t = translations[lang];
  const isRtl = false; // Layout stays LTR for accessibility and right-handed reachability

  // Filters
  const [search, setSearch] = useState('');

  const [localFamily, setLocalFamily] = useState<ProductFamily | 'all'>('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [topSellersOnly, setTopSellersOnly] = useState(false);

  const activeFamily = propFamily !== undefined ? propFamily : localFamily;

  // Automatically scroll back to top of list when any filter or search changes in QuickOrderView
  const isFirstQuickOrderMount = React.useRef(true);
  useEffect(() => {
    if (isFirstQuickOrderMount.current) {
      isFirstQuickOrderMount.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      if (typeof window !== 'undefined' && window.scrollY > 40) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 120);
    return () => clearTimeout(timeout);
  }, [search, activeFamily, inStockOnly, favoritesOnly, topSellersOnly, genderFilter, selectedBrands, showOnlyClearance]);

  const topSellersCount = useMemo(() => products.filter(isProductTopSeller).length, [products]);
  const handleSelectFamily = (fam: ProductFamily | 'all') => {
    if (propOnSelectFamily) {
      propOnSelectFamily(fam);
    } else {
      setLocalFamily(fam);
    }
  };

  // Map of item quantity input state keyed by productId
  const [rowQuantities, setRowQuantities] = useState<Record<string, number>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  // Fast cart lookup
  const cartMap = useMemo(() => {
    const map: Record<string, number> = {};
    cart.forEach((item) => {
      map[item.product.id] = item.quantity;
    });
    return map;
  }, [cart]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (favoritesOnly && !favorites.includes(p.id)) return false;
      if (topSellersOnly && !isProductTopSeller(p)) return false;
      if (activeFamily !== 'all' && p.family !== activeFamily) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (genderFilter !== 'all') {
        const g = normalizeGender(p.gender);
        if (g !== genderFilter && !(g === 'unisex' && genderFilter !== 'unisex')) return false;
      }
      if (selectedBrands.length > 0 && !selectedBrands.includes((p.brand || '').trim())) return false;
      if (showOnlyClearance && !(p.clearance || (p.discountPercent || 0) > 0)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const localized = getProductLocalizedDetails(p, lang);
        const matchCode = (p.code || '').toLowerCase().includes(q);
        const matchName = (localized?.name || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q);
        const matchCat = (localized?.category || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchCat) return false;
      }
      return true;
    });
  }, [products, activeFamily, inStockOnly, search, lang, favoritesOnly, favorites, topSellersOnly, genderFilter, selectedBrands, showOnlyClearance]);

  // Render one layout (phone cards or desktop table) and only a first slice of rows; more load as the user scrolls
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const PAGE_STEP = 30;
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);
  useEffect(() => setVisibleCount(PAGE_STEP), [filteredProducts]);
  const shownProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= filteredProducts.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((c) => c + PAGE_STEP * 2);
      },
      { rootMargin: '800px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, filteredProducts.length]);

  const getRowQty = (product: Product) => {
    if (rowQuantities[product.id] !== undefined) {
      return rowQuantities[product.id];
    }
    // Default: 100 for Extrait, 1 for Flacon
    return product.family === 'Extrait' ? 100 : 1;
  };

  const setRowQty = (productId: string, qty: number) => {
    const safeQty = Math.max(1, qty);
    setRowQuantities((prev) => ({
      ...prev,
      [productId]: safeQty,
    }));
    setInputValues((prev) => ({
      ...prev,
      [productId]: String(safeQty),
    }));
  };

  const handleInputChange = (product: Product, valueStr: string) => {
    setInputValues((prev) => ({ ...prev, [product.id]: valueStr }));
    const parsed = parseInt(valueStr, 10);
    const availableStock = Math.max(0, product.stock - (cartMap[product.id] || 0));
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(availableStock > 0 ? availableStock : 9999, parsed);
      setRowQuantities((prev) => ({ ...prev, [product.id]: clamped }));
    }
  };

  const handleInputBlur = (product: Product) => {
    const availableStock = Math.max(0, product.stock - (cartMap[product.id] || 0));
    const current = inputValues[product.id];
    const parsed = parseInt(current, 10);
    const defaultVal = product.family === 'Extrait' ? 100 : 1;
    if (isNaN(parsed) || parsed < 1) {
      const fallback = Math.max(1, Math.min(availableStock > 0 ? availableStock : 1, defaultVal));
      setRowQty(product.id, fallback);
    } else {
      const clamped = Math.max(1, Math.min(availableStock > 0 ? availableStock : 1, parsed));
      setRowQty(product.id, clamped);
    }
  };

  const handleAddRow = (product: Product) => {
    const availableStock = Math.max(0, product.stock - (cartMap[product.id] || 0));
    if (availableStock <= 0) return;

    const qtyRequested = getRowQty(product);
    const finalQty = Math.min(qtyRequested, availableStock);

    onAddToCart(product, finalQty);

    // After adding, adjust row quantity if remaining stock allows
    const remainingStock = availableStock - finalQty;
    if (remainingStock > 0) {
      const nextDefault = product.family === 'Extrait' ? Math.min(100, remainingStock) : 1;
      setRowQty(product.id, nextDefault);
    }
  };

  const totalCartCount = cart.reduce((sum, item) => sum + (item?.quantity || 0), 0);

  return (
    <div className="min-h-screen bg-[#faf7f9] py-4 sm:py-6 pb-28" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Filter Controls Bar */}
        <div className="max-sm:contents bg-white/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 shadow-2xs border border-rose-100 mb-4 sm:mb-6 space-y-3 transition-all">
          <div className="max-sm:contents flex flex-col sm:flex-row sm:flex-wrap gap-3 items-center sm:items-start">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-md max-sm:mb-2">
              <Search className={`w-4 h-4 text-rose-400 absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
                className={`w-full ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-3 sm:py-2 text-base sm:text-xs bg-white sm:bg-rose-50/30 border border-rose-200/80 rounded-xl text-slate-900 focus:outline-hidden focus:border-[#9f0e4e] focus:ring-2 focus:ring-[#9f0e4e]/10 focus:bg-white transition`}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className={`absolute ${isRtl ? 'left-2.5' : 'right-2.5'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#9f0e4e] text-xs cursor-pointer`}
                >
                  ✕
                </button>
              )}
            </div>

            {onSelectGender && onToggleBrand && onToggleOnlyClearance && (
              <div className="w-full sm:contents max-sm:mb-2">
                <BrandGenderFilters
                  lang={lang}
                  genderFilter={genderFilter}
                  onSelectGender={onSelectGender}
                  genderCounts={genderCounts}
                  brandOptions={brandOptions}
                  selectedBrands={selectedBrands}
                  onToggleBrand={onToggleBrand}
                  showOnlyClearance={showOnlyClearance}
                  onToggleOnlyClearance={onToggleOnlyClearance}
                  clearanceCount={clearanceCount}
                  resultCount={filteredProducts.length}
                />
              </div>
            )}

            {/* Family Tabs */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 max-sm:py-2 max-sm:-mx-3 max-sm:px-3 max-sm:w-[calc(100%+1.5rem)] max-sm:border-b max-sm:border-rose-100 max-sm:mb-2">
              <button
                type="button"
                onClick={() => handleSelectFamily('all')}
                className={`px-3.5 py-3 sm:px-3 sm:py-1.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
                  activeFamily === 'all' && !favoritesOnly
                    ? 'bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white shadow-xs'
                    : 'bg-rose-50/60 text-slate-700 hover:bg-rose-100/60 hover:text-[#9f0e4e]'
                }`}
              >
                {t.filterAll}
              </button>
              <button
                type="button"
                onClick={() => handleSelectFamily('Extrait')}
                className={`px-3.5 py-3 sm:px-3 sm:py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                  activeFamily === 'Extrait' && !favoritesOnly
                    ? 'bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white shadow-xs'
                    : 'bg-rose-50/60 text-slate-700 hover:bg-rose-100/60 hover:text-[#9f0e4e]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-300" />
                {t.extraitsTitle.split(' ')[0]}
              </button>
              <button
                type="button"
                onClick={() => handleSelectFamily('Flacon')}
                className={`px-3.5 py-3 sm:px-3 sm:py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                  activeFamily === 'Flacon' && !favoritesOnly && !topSellersOnly
                    ? 'bg-gradient-to-r from-[#880e4f] to-[#be185d] text-white shadow-xs font-black'
                    : 'bg-rose-50/60 text-slate-700 hover:bg-rose-100/60 hover:text-[#9f0e4e]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {t.flaconsTitle.split(' ')[0]}
              </button>
              <button
                type="button"
                id="quick-order-tab-accessoire"
                onClick={() => handleSelectFamily('Accessoire')}
                className={`px-3.5 py-3 sm:px-3 sm:py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                  activeFamily === 'Accessoire' && !favoritesOnly && !topSellersOnly
                    ? 'bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white shadow-xs font-black'
                    : 'bg-rose-50/60 text-slate-700 hover:bg-rose-100/60 hover:text-[#9f0e4e]'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                {t.accessoriesTitle ? t.accessoriesTitle.split(' ')[0] : 'Accessoires'}
              </button>

              {/* Top Seller toggle */}
              <button
                type="button"
                onClick={() => setTopSellersOnly((v) => !v)}
                className={`px-3.5 py-3 sm:px-3 sm:py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                  topSellersOnly
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-xs ring-2 ring-amber-400/40'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
                }`}
                title="Afficher uniquement les meilleures ventes (stock élevé)"
              >
                <Flame className={`w-3.5 h-3.5 ${topSellersOnly ? 'fill-slate-950 text-slate-950' : 'text-amber-600'}`} />
                <span>{t.topSellers}</span>
                {topSellersCount > 0 && <span className="text-[10px] opacity-80">({topSellersCount})</span>}
              </button>

              {/* Favorites toggle */}
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={() => setFavoritesOnly((v) => !v)}
                  className={`px-3.5 py-3 sm:px-3 sm:py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                    favoritesOnly
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-white' : 'fill-rose-500 text-rose-500'}`} />
                  <span>{t.favorites} ({favorites.length})</span>
                </button>
              )}

              {/* In Stock toggle */}
              <button
                type="button"
                onClick={() => setInStockOnly((v) => !v)}
                className={`px-3.5 py-3 sm:px-3 sm:py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer whitespace-nowrap ${
                  inStockOnly
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                ✓ {t.filterInStock}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 max-sm:border-0 max-sm:pb-2">
            <span className="max-sm:hidden">
              <strong className="text-slate-800">{filteredProducts.length}</strong> {t.productsFound}
            </span>
            {!isPricesVisible && (
              <span className="text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 text-[11px] font-bold flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-600" />
                {t.unauthenticatedCanAdd}
              </span>
            )}
          </div>
        </div>

        {/* Loading Skeleton State */}
        {isLoading ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-600">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {lang === 'ar' ? 'جاري تحميل وتحديث جدول الأسعار والمخزون...' : 'Chargement de la grille des prix et stocks...'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'ar' ? 'يتم الاتصال بقاعدة بيانات Tulip' : 'Connexion en direct avec le serveur Tulip'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden animate-pulse">
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                    <div className="h-4 w-16 bg-slate-200 rounded" />
                    <div className="h-4 w-44 bg-slate-200 rounded flex-1" />
                    <div className="h-4 w-20 bg-slate-100 rounded" />
                    <div className="h-4 w-16 bg-amber-100 rounded" />
                    <div className="h-8 w-28 bg-slate-200 rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">{t.noProductsFound}</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                handleSelectFamily('all');
                setInStockOnly(false);
              }}
              className="mt-3 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
            >
              {lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Réinitialiser les filtres'}
            </button>
          </div>
        ) : (
          <>
            {/* PHONE LIST: no photos, one compact row per article with a live -/+ counter */}
            <div className="md:hidden bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {(isDesktop ? [] : shownProducts).map((product) => {
                const isExtrait = product.family === 'Extrait';
                const localized = getProductLocalizedDetails(product, lang);
                const cartQty = cartMap[product.id] || 0;
                const step = isExtrait ? 100 : 1;
                const unitLabel = isExtrait ? 'g' : 'pcs';
                const isOutOfStock = product.stock <= 0;
                const unitPrice = getUnitPrice(product, Math.max(1, cartQty), offers);
                const nudge = isPricesVisible ? volumeNudge(product, cartQty, offers) : null;
                const setQty = (n: number) => {
                  const clamped = Math.max(0, Math.min(product.stock, n));
                  if (cartQty === 0) {
                    if (clamped > 0) onAddToCart(product, clamped);
                  } else if (clamped === 0 && onDecreaseCartQuantity) {
                    onDecreaseCartQuantity(product.id, cartQty);
                  } else {
                    onUpdateCartQuantity(product.id, clamped);
                  }
                };

                return (
                  <div
                    key={product.id}
                    className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2 border-b border-slate-100 last:border-b-0 ${
                      cartQty > 0 ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onQuickView(product)}
                        className="block text-left w-full font-bold text-[13.5px] uppercase leading-tight text-slate-900 break-words cursor-pointer"
                      >
                        {localized.name}
                      </button>
                      <div className="font-mono text-xs text-slate-500 mt-0.5">
                        {product.code}
                        {isPricesVisible ? (
                          <>
                            {' · '}
                            <span className={unitPrice < product.priceDA ? 'text-emerald-700 font-bold' : ''}>
                              {formatDZD(unitPrice)}
                              {isExtrait ? ' /g' : ''}
                            </span>
                            {unitPrice < product.priceDA && (
                              <span className="line-through text-slate-400 ml-1">{formatDZD(product.priceDA)}</span>
                            )}
                          </>
                        ) : (
                          <Lock className="w-3 h-3 inline ml-1.5 text-amber-600" />
                        )}
                      </div>
                      {(() => {
                        const lowAt = product.lowStockThreshold || product.minAlertStock || 5;
                        const isLow = product.stock > 0 && product.stock <= lowAt;
                        const hasSale = Boolean(product.discountPercent && product.discountPercent > 0);
                        if (!product.unit && !hasSale && !isLow) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-500">
                            {product.unit && <span>{isExtrait ? '1g · 100g' : product.unit}</span>}
                            {hasSale && (
                              <span className="px-1.5 py-px rounded-full bg-rose-600 text-white font-black">
                                -{product.discountPercent}%
                              </span>
                            )}
                            {isLow && (
                              <span className="text-rose-700 font-bold">
                                {lang === 'ar'
                                  ? `بقي ${product.stock}${isExtrait ? ' غ' : ''} فقط`
                                  : lang === 'en'
                                  ? `Only ${product.stock}${isExtrait ? ' g' : ''} left`
                                  : `Plus que ${product.stock}${isExtrait ? ' g' : ''}`}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {isOutOfStock ? (
                      <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold">
                        {t.outOfStock}
                      </span>
                    ) : (
                      <div className="inline-flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white">
                        <button
                          type="button"
                          disabled={cartQty === 0}
                          onClick={() => setQty(cartQty - step)}
                          className="w-11 h-11 text-[#9f0e4e] text-xl font-medium disabled:text-slate-300 cursor-pointer"
                          aria-label="Diminuer la quantité"
                        >
                          −
                        </button>
                        <div className="flex items-baseline justify-center w-[72px]">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={product.stock}
                            value={cartQty || ''}
                            placeholder="0"
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10);
                              setQty(isNaN(n) ? 0 : n);
                            }}
                            className="w-12 text-center text-base font-bold font-mono text-slate-900 bg-transparent focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            aria-label={`Quantité ${localized.name}`}
                          />
                          <span className="text-[11px] text-slate-500 font-mono">{cartQty ? unitLabel : ''}</span>
                        </div>
                        <button
                          type="button"
                          disabled={cartQty >= product.stock}
                          onClick={() => setQty(cartQty + step)}
                          className="w-11 h-11 text-[#9f0e4e] text-xl font-medium disabled:text-slate-300 cursor-pointer"
                          aria-label="Augmenter la quantité"
                        >
                          +
                        </button>
                      </div>
                    )}

                    {nudge && nudge.minQty - cartQty <= product.stock - cartQty && (
                      <div className="col-span-2 flex items-center justify-between gap-2 text-xs text-emerald-800">
                        <span className="leading-snug">
                          {lang === 'ar' ? 'أضف' : 'Ajoutez'} <b><bdi dir="ltr">+{nudge.missing} {unitLabel}</bdi></b> :{' '}
                          <bdi dir="ltr">{formatDZD(nudge.nextUnit)}{isExtrait ? '/g' : ''}</bdi> · {lang === 'ar' ? 'توفر' : 'économie'}{' '}
                          <b><bdi dir="ltr">{formatDZD(nudge.savingDA)}</bdi></b>
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(nudge.minQty)}
                          className="shrink-0 h-9 px-3 rounded-lg border border-emerald-600 text-emerald-700 font-bold cursor-pointer"
                        >
                          {lang === 'ar' ? `إلى ${nudge.minQty}` : `Passer à ${nudge.minQty}`}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>


            {/* DESKTOP TABLE: Full High-Density Grid */}
            <div className="hidden md:block bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-300 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                      <th className="py-3.5 px-4 w-20 text-center">{t.colCode}</th>
                      <th className="py-3.5 px-4">{t.colProduct}</th>
                      <th className="py-3.5 px-4">{t.colFamily}</th>
                      <th className="py-3.5 px-3 text-center">{t.colAvailability}</th>
                      <th className="py-3.5 px-4 text-right">{t.colUnitPrice}</th>
                      <th className="py-3.5 px-4 text-center w-52">{t.colQuantity}</th>
                      <th className="py-3.5 px-4 text-center w-40">{t.colAction}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {(isDesktop ? shownProducts : []).map((product) => {
                      const isExtrait = product.family === 'Extrait';
                      const localized = getProductLocalizedDetails(product, lang);
                      const cartQty = cartMap[product.id] || 0;
                      const availableStock = Math.max(0, product.stock - cartQty);
                      const isOutOfStock = product.stock <= 0;
                      const isAllInCart = availableStock <= 0 && product.stock > 0;
                      const currentQty = getRowQty(product);
                      const isItemInCart = cartQty > 0;

                      const discountedPriceDA = getUnitPrice(product, Math.max(1, cartQty + currentQty), offers);
                      const hasDiscount = discountedPriceDA < product.priceDA;

                      return (
                        <tr
                          key={product.id}
                          className={`hover:bg-slate-50/90 transition-colors ${
                            isItemInCart ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          {/* Code */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                              {product.code}
                            </span>
                          </td>

                          {/* Product Title & Thumbnail */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  product.imageUrl && !product.imageUrl.includes('photo-1608571423902')
                                    ? product.imageUrl
                                    : isExtrait
                                    ? '/tulip-extrait-default.jpg'
                                    : (product.imageUrl || 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=200')
                                }
                                alt={localized.name}
                                width={48}
                                height={48}
                                loading="lazy"
                                decoding="async"
                                className="w-12 h-12 rounded-xl object-cover bg-slate-100 shrink-0 border border-slate-200 cursor-zoom-in hover:scale-110 active:scale-95 transition-transform"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const target = e.currentTarget as HTMLImageElement;
                                  target.onerror = null;
                                  target.src = isExtrait ? '/tulip-extrait-default.jpg' : 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=200';
                                }}
                                onClick={() => onQuickView(product)}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {onToggleFavorite && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleFavorite(product.id);
                                      }}
                                      className={`p-1 rounded-full transition cursor-pointer ${
                                        favorites.includes(product.id)
                                          ? 'text-rose-600 bg-rose-50'
                                          : 'text-slate-300 hover:text-rose-500'
                                      }`}
                                      title={favorites.includes(product.id) ? t.removeFromFavorites : t.addToFavorites}
                                    >
                                      <Heart className={`w-3.5 h-3.5 ${favorites.includes(product.id) ? 'fill-current' : ''}`} />
                                    </button>
                                  )}
                                  <span
                                    className="font-bold text-slate-900 hover:text-amber-700 transition cursor-pointer"
                                    onClick={() => onQuickView(product)}
                                    title={localized.name}
                                  >
                                    {localized.name}
                                  </span>

                                  {/* BIG SOLDE STICKER IN DESKTOP TABLE */}
                                  {hasDiscount && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-xs tracking-wider uppercase border border-white">
                                      🔥 -{product.discountPercent}% {t.soldeBadge}
                                    </span>
                                  )}

                                  {/* TOP SELLER BADGE IN DESKTOP TABLE */}
                                  {isProductTopSeller(product) && !hasDiscount && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-xs flex items-center gap-1 border border-amber-300">
                                      <Flame className="w-3 h-3 fill-slate-950 text-slate-950" />
                                      <span>{t.topSellerBadge}</span>
                                    </span>
                                  )}

                                  {localized.category && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                      {localized.category}
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span>{isExtrait ? 'Extrait pur 1g (flacon scellé 100g)' : product.unit}</span>
                                  {isItemInCart && (
                                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                      ✓ {cartQty} {isExtrait ? 'g' : 'u'} {t.inCart}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Family / Packaging */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                isExtrait
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : product.family === 'Accessoire'
                                  ? 'bg-teal-100 text-teal-900 border border-teal-300'
                                  : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                              }`}
                            >
                              {isExtrait ? (
                                <Sparkles className="w-3 h-3 text-amber-700" />
                              ) : product.family === 'Accessoire' ? (
                                <Wrench className="w-3 h-3 text-teal-700" />
                              ) : (
                                <Layers className="w-3 h-3 text-indigo-700" />
                              )}
                              {product.family}
                            </span>
                          </td>

                          {/* Availability */}
                          <td className="py-3.5 px-3 text-center">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                                <XCircle className="w-3 h-3" />
                                {t.filterOutOfStock}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {t.filterInStock}
                              </span>
                            )}
                          </td>

                          {/* Unit Price (With Prominent Solde Support) */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {isPricesVisible ? (
                              <div>
                                {hasDiscount ? (
                                  <div>
                                    <div className="font-black text-rose-600 text-sm">
                                      {formatDZD(discountedPriceDA)}
                                    </div>
                                    <div className="text-[10px] text-slate-400 line-through">
                                      {formatDZD(product.priceDA)}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="font-black text-slate-900 text-sm">
                                    {formatDZD(product.priceDA)}
                                  </div>
                                )}
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {isExtrait ? t.perGram : t.perPiece}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end">
                                <button
                                  type="button"
                                  onClick={onRequireLogin}
                                  className="px-2.5 py-1 text-[11px] font-black bg-[#9f0e4e] hover:bg-[#880e4f] text-white rounded-lg shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                                >
                                  <Lock className="w-3 h-3 text-pink-200 shrink-0" />
                                  <span>{t.loginBtn}</span>
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Quantity Controls */}
                          <td className="py-3.5 px-4">
                            {isOutOfStock ? (
                              <div className="text-center text-[11px] text-slate-400 italic">
                                {t.outOfStock}
                              </div>
                            ) : isAllInCart ? (
                              <div className="text-center text-[11px] text-emerald-800 font-bold bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                                ✓ Tout en bon ({cartQty}{isExtrait ? 'g' : ''})
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="flex items-center border border-slate-300 rounded-xl bg-slate-50 overflow-hidden shadow-inner">
                                  <button
                                    type="button"
                                    onClick={() => setRowQty(product.id, Math.max(1, currentQty - (isExtrait ? 100 : 1)))}
                                    disabled={currentQty <= 1}
                                    className="px-2.5 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    max={availableStock}
                                    value={inputValues[product.id] ?? currentQty}
                                    onChange={(e) => handleInputChange(product, e.target.value)}
                                    onBlur={() => handleInputBlur(product)}
                                    className="w-14 text-center font-bold text-xs bg-transparent text-slate-900 focus:outline-hidden"
                                  />
                                  <span className="text-[10px] font-bold text-slate-400 pr-1">
                                    {isExtrait ? 'g' : 'u'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setRowQty(product.id, Math.min(availableStock, currentQty + (isExtrait ? 100 : 1)))}
                                    disabled={currentQty >= availableStock}
                                    className="px-2.5 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>

                                {/* Presets for extraits */}
                                {isExtrait && (
                                  <div className="flex items-center gap-1 text-[10px]">
                                    {[100, 200, 500].map((preset) => {
                                      if (preset > availableStock && preset !== 100) return null;
                                      return (
                                        <button
                                          key={preset}
                                          type="button"
                                          onClick={() => setRowQty(product.id, Math.min(availableStock, preset))}
                                          className={`px-1.5 py-0.2 rounded font-bold border cursor-pointer ${
                                            currentQty === preset
                                              ? 'bg-amber-500 text-slate-950 border-amber-600'
                                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                          }`}
                                        >
                                          {preset}g
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Action Button: STAYS ON WHEN IN CART */}
                          <td className="py-3.5 px-4 text-center">
                            {isOutOfStock ? (
                              <button
                                disabled
                                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 text-[11px] font-medium cursor-not-allowed border border-slate-200"
                              >
                                Épuisé
                              </button>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAddRow(product)}
                                  disabled={isAllInCart}
                                  className={`w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
                                    isItemInCart
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/30'
                                      : isAllInCart
                                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                                  }`}
                                >
                                  {isItemInCart ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>
                                        ✓ {t.addedToCart} ({cartQty}{isExtrait ? 'g' : ''})
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>{t.addToPreorder}</span>
                                    </>
                                  )}
                                </button>

                                {isItemInCart && onDecreaseCartQuantity && (
                                  <button
                                    type="button"
                                    onClick={() => onDecreaseCartQuantity(product.id, isExtrait ? 100 : 1)}
                                    className="w-full py-1.5 px-3 text-[11px] font-black rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 hover:text-rose-950 border border-rose-200 hover:border-rose-300 transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
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
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div ref={sentinelRef} className="h-px" aria-hidden="true" />
          </>
        )}
      </div>
    </div>
  );
};
