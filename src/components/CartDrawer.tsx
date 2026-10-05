import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  ShoppingBag,
  Lock,
  LogIn,
  Bookmark,
  BookmarkCheck,
  RotateCcw,
  Clock,
  FileText,
  Check,
  Sparkles,
  Package,
} from 'lucide-react';
import { Product, CartItem, SavedPreorder } from '../types';
import { calculateDiscountedPrice } from '../utils/productUtils';
import { formatDZD } from '../utils/pdfGenerator';
import { AppLanguage, translations } from '../translations';
import { getProductLocalizedDetails } from '../data/productTranslations';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, newQty: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onProceedToCheckout: () => void;
  onProceedToProforma?: () => void;
  isPricesVisible?: boolean;
  onRequireLogin?: () => void;
  lang?: AppLanguage;
  savedPreorders: SavedPreorder[];
  onSaveCurrentCart: (label?: string) => void;
  onLoadSavedPreorder: (savedOrder: SavedPreorder) => void;
  onDeleteSavedPreorder: (id: string) => void;
  allProducts?: Product[];
  onAddToCart?: (product: Product, quantityToAdd: number) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
  onProceedToProforma,
  isPricesVisible = false,
  onRequireLogin,
  lang = 'ar',
  savedPreorders = [],
  onSaveCurrentCart,
  onLoadSavedPreorder,
  onDeleteSavedPreorder,
  allProducts = [],
  onAddToCart,
}) => {
  const t = translations[lang];
  const isRtl = false; // Layout stays LTR for accessibility and right-handed reachability
  const [activeTab, setActiveTab] = useState<'cart' | 'saved'>('cart');
  const [savedToast, setSavedToast] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [isNamingDraft, setIsNamingDraft] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [upsellNextAction, setUpsellNextAction] = useState<'preorder' | 'proforma' | null>(null);

  // Escape key to close cart drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Find in-stock, visible accessories in catalog to propose as upsell
  // Declared at the top level (before any conditional return) to satisfy the Rules of Hooks!
  const availableAccessories = React.useMemo(() => {
    return (allProducts || []).filter(
      (p) => p.family === 'Accessoire' && p.stock > 0 && !p.isHidden
    ); // Show all visible in-stock accessories without truncation
  }, [allProducts]);

  const handleProceedClick = (action: 'preorder' | 'proforma') => {
    const hasAccessories = items.some((item) => item.product?.family === 'Accessoire');
    if (!hasAccessories && availableAccessories.length > 0) {
      setUpsellNextAction(action);
      setShowUpsell(true);
    } else {
      if (action === 'preorder') {
        onProceedToCheckout();
      } else {
        if (onProceedToProforma) {
          onProceedToProforma();
        } else {
          onProceedToCheckout();
        }
      }
    }
  };

  const handleCompleteUpsell = () => {
    setShowUpsell(false);
    const action = upsellNextAction;
    setUpsellNextAction(null);
    if (action === 'preorder') {
      onProceedToCheckout();
    } else {
      if (onProceedToProforma) {
        onProceedToProforma();
      } else {
        onProceedToCheckout();
      }
    }
  };

  if (!isOpen) return null;

  const getItemUnitPrice = (item: CartItem) => {
    if (!item || !item.product) return 0;
    return calculateDiscountedPrice(item.product.priceDA, item.product.discountPercent);
  };

  const validItems = items.filter((item) => item && item.product && typeof item.quantity === 'number');

  const totalAmountDA = validItems.reduce(
    (sum, item) => sum + getItemUnitPrice(item) * (item.quantity || 0),
    0
  );

  const handleSaveForLater = () => {
    if (items.length === 0) return;
    const defaultLabel =
      draftLabel.trim() ||
      `Bon du ${new Date().toLocaleDateString('fr-DZ', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    onSaveCurrentCart(defaultLabel);
    setDraftLabel('');
    setIsNamingDraft(false);
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div
        className={`fixed inset-y-0 ${
          isRtl ? 'left-0 sm:pr-8 md:pr-10' : 'right-0 sm:pl-8 md:pl-10'
        } max-w-full w-full sm:w-auto flex`}
      >
        <div className="w-full sm:w-[480px] sm:max-w-md bg-white shadow-2xl flex flex-col justify-between h-full max-h-screen">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-[#500428] via-[#70083b] to-[#9f0e4e] text-white flex items-center justify-between border-b border-[#500428] shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/20 text-white font-black border border-white/25 shadow-xs">
                <ShoppingBag className="w-5 h-5 text-rose-100" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">{t.cartTitle}</h2>
                <p className="text-xs text-rose-200">
                  {items.length} {t.orderItemsCount}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-rose-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
                aria-label="Fermer"
                title="Fermer (Échap)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs between Current Cart & Saved Pre-orders */}
          <div className="flex border-b border-rose-100 bg-rose-50/70 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('cart')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'cart'
                  ? 'bg-white text-[#9f0e4e] shadow-xs font-black'
                  : 'text-slate-600 hover:text-[#70083b]'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#9f0e4e]" />
              <span>
                {t.cartTabActive} ({items.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'saved'
                  ? 'bg-white text-[#9f0e4e] shadow-xs font-black'
                  : 'text-slate-600 hover:text-[#70083b]'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5 text-[#9f0e4e]" />
              <span>{t.cartTabSaved}</span>
              {savedPreorders.length > 0 && (
                <span className="px-1.5 py-0.2 bg-[#9f0e4e] text-white rounded-full text-[10px] font-black">
                  {savedPreorders.length}
                </span>
              )}
            </button>
          </div>

          {/* Toast Notification when saved */}
          {savedToast && (
            <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <span className="flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-emerald-200" />
                {t.savedOrderSuccess}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('saved')}
                className="underline text-emerald-100 hover:text-white ml-2 text-[11px] cursor-pointer"
              >
                {t.cartTabSaved}
              </button>
            </div>
          )}

          {/* TAB 1: ACTIVE CART ITEMS */}
          {activeTab === 'cart' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {validItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-700 mb-1">
                    {t.cartEmpty}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mb-4">
                    {t.cartEmptySub}
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    {t.allProducts}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                    <span className="text-slate-500 font-medium">{t.quickOrderSummary}</span>
                    <button
                      type="button"
                      onClick={onClearCart}
                      className="text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t.clearCartBtn}
                    </button>
                  </div>

                  {/* List of items */}
                  <div className="space-y-3">
                    {validItems.map(({ product, quantity }) => {
                      const isExtrait = product.family === 'Extrait';
                      const step = isExtrait ? 100 : 1;
                      const maxAllowed = product.stock;
                      const isMaxReached = quantity >= maxAllowed;
                      const loc = getProductLocalizedDetails(product, lang);

                      return (
                        <div
                          key={product.id}
                          className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex gap-3 relative group hover:border-slate-300 transition"
                        >
                          <img
                            src={
                              product.imageUrl && !product.imageUrl.includes('photo-1608571423902')
                                ? product.imageUrl
                                : product.family === 'Extrait'
                                ? '/tulip-extrait-default.jpg'
                                : product.family === 'Accessoire'
                                ? 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600'
                                : (product.imageUrl || 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600')
                            }
                            alt={loc.name}
                            className="w-16 h-16 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              target.onerror = null;
                              target.src =
                                product.family === 'Extrait'
                                  ? '/tulip-extrait-default.jpg'
                                  : product.family === 'Accessoire'
                                  ? 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600'
                                  : 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600';
                            }}
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <span className="font-mono text-[10px] text-slate-500 block">
                                  {product.code}
                                </span>
                                <h4 className="text-xs font-bold text-slate-900 truncate">
                                  {loc.name}
                                </h4>
                              </div>
                              <button
                                type="button"
                                onClick={() => onRemoveItem(product.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="mt-1 flex items-center gap-2">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  isExtrait
                                    ? 'bg-amber-100 text-amber-900'
                                    : product.family === 'Accessoire'
                                    ? 'bg-teal-100 text-teal-900'
                                    : 'bg-indigo-100 text-indigo-900'
                                }`}
                              >
                                {isExtrait
                                  ? t.extraitsTitle.split(' ')[0]
                                  : product.family === 'Accessoire'
                                  ? (t.accessoriesTitle ? t.accessoriesTitle.split(' ')[0] : 'Accessoires')
                                  : t.flaconsTitle.split(' ')[0]}
                              </span>
                              {isExtrait && (
                                <span className="text-amber-800 text-[10px]">
                                  (100g)
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex items-center justify-between">
                              {/* Quantity control */}
                              <div className="flex items-center border border-slate-300 rounded-lg bg-white">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateQuantity(
                                      product.id,
                                      Math.max(1, quantity - step)
                                    )
                                  }
                                  className="px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                  aria-label="Diminuer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>

                                <div className="px-1.5 text-center">
                                  <span className="text-xs font-bold text-slate-900">
                                    {quantity}
                                    {isExtrait ? 'g' : ''}
                                  </span>
                                  {isExtrait && (
                                    <span className="block text-[9px] text-slate-400 leading-none">
                                      {(quantity / 100).toFixed(
                                        quantity % 100 === 0 ? 0 : 1
                                      )}{' '}
                                      fl.
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateQuantity(
                                      product.id,
                                      Math.min(maxAllowed, quantity + step)
                                    )
                                  }
                                  disabled={isMaxReached}
                                  className="px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                  aria-label="Augmenter"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Line total or Hidden Price */}
                              <div className="text-right">
                                {isPricesVisible ? (
                                  <>
                                    <span className="text-xs font-black text-slate-900">
                                      {formatDZD(
                                        getItemUnitPrice({ product, quantity }) *
                                          quantity
                                      )}
                                    </span>
                                    {product.discountPercent && product.discountPercent > 0 ? (
                                      <span className="block text-[10px] text-rose-600 font-bold">
                                        -{product.discountPercent}% (
                                        {formatDZD(
                                          getItemUnitPrice({ product, quantity })
                                        )}{' '}
                                        {isExtrait ? '/ 1g' : '/ u'})
                                      </span>
                                    ) : (
                                      <span className="block text-[10px] text-slate-500">
                                        ({formatDZD(product.priceDA)}{' '}
                                        {isExtrait ? '/ 1g' : '/ u'})
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-[11px] font-semibold text-amber-700 flex items-center justify-end gap-1">
                                    <Lock className="w-3 h-3 text-amber-600" />
                                    <span>{t.priceHiddenNotice}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {isMaxReached && (
                              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                Stock max atteint
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Stock Reservation Info Box */}
                  <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200 text-xs text-slate-800 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-950">Garantie Réservation 48H :</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                        Dès l'envoi de votre bon ou demande de proforma, le stock est réservé pendant 48 heures.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: SAVED PRE-ORDERS LIST */}
          {activeTab === 'saved' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {savedPreorders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <Bookmark className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-700 mb-1">
                    {t.noSavedPreorders}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mb-4">
                    Sauvegardez vos sélections en un clic pour les retrouver plus tard.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('cart')}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    Retour au bon en cours
                  </button>
                </div>
              ) : (
                <>
                  <div className="pb-2 border-b border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                    <span>{savedPreorders.length} {t.savedDraftsCount}</span>
                    <span className="text-[11px] text-slate-400">Restaurable à tout moment</span>
                  </div>

                  {savedPreorders.map((savedOrder) => {
                    const totalQty = savedOrder.items.reduce(
                      (s, it) => s + it.quantity,
                      0
                    );

                    return (
                      <div
                        key={savedOrder.id}
                        className="p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">
                              {savedOrder.label || 'Bon de précommande sauvegardé'}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(savedOrder.savedAt).toLocaleDateString(
                                  'fr-DZ',
                                  {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onDeleteSavedPreorder(savedOrder.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-200 transition cursor-pointer"
                            title={t.deleteSavedOrderBtn}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Items preview */}
                        <div className="space-y-1 bg-white p-2 rounded-xl border border-slate-200">
                          {savedOrder.items.slice(0, 3).map((item) => (
                            <div
                              key={item.product.id}
                              className="flex items-center justify-between text-[11px] text-slate-700"
                            >
                              <span className="truncate max-w-[180px] font-medium">
                                • {item.product.name}
                              </span>
                              <span className="font-mono text-slate-500">
                                {item.quantity}
                                {item.product.family === 'Extrait' ? 'g' : 'u'}
                              </span>
                            </div>
                          ))}
                          {savedOrder.items.length > 3 && (
                            <p className="text-[10px] text-slate-400 italic text-center pt-0.5">
                              + {savedOrder.items.length - 3} autres référence(s)
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="text-xs">
                            <span className="text-slate-500 text-[11px]">
                              Contenu :{' '}
                            </span>
                            <span className="font-bold text-slate-900">
                              {savedOrder.items.length} réf.
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              {' '}
                              ({totalQty} unités/g)
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              onLoadSavedPreorder(savedOrder);
                              setActiveTab('cart');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-400" />
                            <span>{t.restoreOrderBtn}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* FOOTER & CHECKOUT ACTION (ONLY RELEVANT FOR ACTIVE CART TAB) */}
          {activeTab === 'cart' && items.length > 0 && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>{t.quickOrderSummary} :</span>
                <span className="font-bold text-slate-900">{items.length} réf.</span>
              </div>

              {isPricesVisible ? (
                <div className="flex items-baseline justify-between pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-xs text-slate-600 block">
                      {t.totalEstimation} :
                    </span>
                    <span className="text-xl font-black text-slate-950">
                      {formatDZD(totalAmountDA)}
                    </span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                    Tarif Grossiste Validé
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-rose-50/80 rounded-2xl border border-rose-200/90 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#70083b] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#9f0e4e]" />
                      {t.pricesLocked}
                    </span>
                    {onRequireLogin && (
                      <button
                        type="button"
                        onClick={onRequireLogin}
                        className="text-white font-black hover:opacity-90 cursor-pointer bg-[#9f0e4e] px-2.5 py-0.5 rounded-md text-[11px] shadow-xs"
                      >
                        {t.loginBtn}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[#880e4f] leading-relaxed">
                    {t.proformaNotice}
                  </p>
                </div>
              )}

              {/* USER DIRECTIVE: SAVE FOR LATER BUTTON PLACED ABOVE SUBMIT BUTTON */}
              <div className="pt-1 border-t border-slate-200">
                {!isNamingDraft ? (
                  <button
                    type="button"
                    onClick={() => setIsNamingDraft(true)}
                    className="w-full py-2 px-3 rounded-xl bg-rose-50/60 hover:bg-rose-100/70 text-[#70083b] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer border border-rose-200/80"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-[#9f0e4e]" />
                    <span>{t.saveForLaterBtn}</span>
                  </button>
                ) : (
                  <div className="p-2.5 bg-white border border-rose-300 rounded-xl space-y-2 shadow-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#70083b]">Nommer ce brouillon :</span>
                      <button
                        type="button"
                        onClick={() => setIsNamingDraft(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                        placeholder="Ex : Commande Oud Mars 2026..."
                        className="flex-1 px-2.5 py-1.5 text-xs border border-rose-200 rounded-lg focus:outline-hidden focus:border-[#9f0e4e]"
                      />
                      <button
                        type="button"
                        onClick={handleSaveForLater}
                        className="px-3 py-1.5 bg-[#9f0e4e] hover:bg-[#70083b] text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* USER DIRECTIVE: DISABLE UNTIL AN APPROVED WHOLESALE CUSTOMER LOGS IN,
                  AND ALLOW THE NON SIGN/LOG CUSTOMER TO ASK FOR PROFORMA BY SENDING THE ORDER */}
              {isPricesVisible ? (
                /* APPROVED WHOLESALE CUSTOMER LOGGED IN */
                <button
                  id="btn-proceed-preorder"
                  type="button"
                  onClick={() => handleProceedClick('preorder')}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white font-black text-sm flex items-center justify-center gap-2 transition shadow-lg hover:shadow-xl cursor-pointer"
                >
                  <span>{t.proceedToPreorderBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                /* NON-LOGGED / GUEST CUSTOMER: PROFORMA REQUEST FLOW */
                <div className="space-y-2">
                  <button
                    id="btn-request-proforma"
                    type="button"
                    onClick={() => handleProceedClick('proforma')}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/20 hover:shadow-xl transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-white" />
                    <span>{t.requestProformaBtn}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {onRequireLogin && (
                    <button
                      type="button"
                      onClick={onRequireLogin}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5 text-slate-600" />
                      <span>{t.loginToUnlock}</span>
                    </button>
                  )}
                </div>
              )}

              <p className="text-[11px] text-center text-slate-500">
                Génération instantanée du bon officiel ou proforma en PDF
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Accessories Upsell Modal for both logged-in and guest customers */}
      {showUpsell && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Modal Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
            onClick={handleCompleteUpsell} 
          />

          {/* Modal Content Card */}
          <div className="relative w-full max-w-xl bg-slate-900 border border-[#70083b]/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header banner */}
            <div className="bg-gradient-to-r from-[#500428] via-[#70083b] to-[#9f0e4e] p-6 text-white text-center relative">
              <button
                type="button"
                onClick={handleCompleteUpsell}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition text-rose-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 animate-pulse">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-lg font-black tracking-tight sm:text-xl">
                {lang === 'ar' ? 'مستلزمات ضرورية لمنتج مكتمل ؟' : lang === 'en' ? 'Tulip • Suggested Accessories' : 'Atelier Tulip • Merveilleux Accessoires'}
              </h3>
              <p className="text-xs text-rose-100/85 mt-1 max-w-md mx-auto leading-relaxed">
                {lang === 'ar' 
                  ? 'أضف الملحقات الضرورية لتجهيز طلبك بالشكل الصحيح: كحول ,مضخات، أغطية فاخرة، علب هدايا، وأدوات تحضير..'
                  : lang === 'en'
                  ? 'Complete your selection with high-quality pumps, designer caps, luxury gift boxes, or perfume workshop tools.'
                  : 'Complétez votre sélection avec nos flacons d’échantillons, capsules dorées, pompes professionnelles ou coffrets de luxe.'}
              </p>
            </div>

            {/* Accessory grid scroll area */}
            <div className="p-6 overflow-y-auto space-y-4 max-h-[50vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableAccessories.map((product) => {
                  const details = getProductLocalizedDetails(product, lang);
                  const isAlreadyInCart = items.some((i) => i.product.id === product.id);
                  const cartItem = items.find((i) => i.product.id === product.id);
                  const price = calculateDiscountedPrice(product.priceDA, product.discountPercent);

                  return (
                    <div 
                      key={product.id}
                      className="bg-slate-950 rounded-2xl border border-slate-800 p-3.5 flex flex-col justify-between space-y-3 shadow-inner hover:border-amber-500/20 transition-all duration-300"
                    >
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                          {product.imageUrl ? (
                            <img 
                              src={product.imageUrl} 
                              alt={details.name} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/tulip-extrait-default.jpg';
                              }}
                            />
                          ) : (
                            <Package className="w-5 h-5 text-slate-500" />
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-[9px] font-mono font-bold text-amber-500 uppercase tracking-wider block">
                            {product.code}
                          </span>
                          <h4 className="text-xs font-bold text-white truncate">
                            {details.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {product.unit}
                          </span>
                        </div>
                      </div>

                      {/* Pricing & Add Trigger */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                        {isPricesVisible ? (
                          <span className="text-xs font-extrabold text-amber-400 font-mono">
                            {formatDZD(price)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            <Lock className="w-2.5 h-2.5 text-amber-400" />
                            <span>{t.priceHiddenNotice}</span>
                          </span>
                        )}

                        {isAlreadyInCart && cartItem ? (
                          <div className="flex items-center gap-2 bg-[#70083b]/20 border border-[#70083b]/40 rounded-xl px-1.5 py-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (cartItem.quantity <= 1) {
                                  onRemoveItem(product.id);
                                } else {
                                  onUpdateQuantity(product.id, cartItem.quantity - 1);
                                }
                              }}
                              className="w-5 h-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center text-xs transition cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-mono font-bold text-amber-200 min-w-[14px] text-center">
                              {cartItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateQuantity(product.id, cartItem.quantity + 1);
                              }}
                              className="w-5 h-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center text-xs transition cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (onAddToCart) {
                                onAddToCart(product, 1);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black transition cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <Plus className="w-3 h-3 stroke-[3]" />
                            <span>{lang === 'ar' ? 'إضافة' : 'Ajouter'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleCompleteUpsell}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition text-center cursor-pointer"
              >
                {lang === 'ar' ? 'متابعة بدون ملحقات' : lang === 'en' ? 'Continue without accessories' : 'Continuer sans accessoires'}
              </button>
              <button
                type="button"
                onClick={handleCompleteUpsell}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white text-xs font-black transition text-center cursor-pointer shadow-lg shadow-rose-950/20"
              >
                {lang === 'ar' ? 'تأكيد وإنهاء الطلب' : lang === 'en' ? 'Confirm and Checkout' : 'Valider et finaliser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
