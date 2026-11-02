import React, { useEffect, useMemo, useState } from 'react';
import { X, Heart, Trash2, Plus, Minus, ShoppingCart, Pencil, Check, Package } from 'lucide-react';
import { Product } from '../types';
import { AppLanguage } from '../translations';
import { calculateDiscountedPrice } from '../utils/productUtils';
import { defaultAddQuantity } from '../utils/offers';
import { formatDZD } from '../utils/formatDZD';
import { getProductLocalizedDetails } from '../data/productTranslations';

interface ManageFavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  favorites: string[];
  onRemoveFavorite: (productId: string) => void;
  onClearFavorites: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  isPricesVisible?: boolean;
  lang?: AppLanguage;
}

/**
 * "Manage favorites": the customer reviews saved products, edits the quantity
 * to order, removes products, and adds one or all of them to the cart.
 */
export const ManageFavoritesModal: React.FC<ManageFavoritesModalProps> = ({
  isOpen,
  onClose,
  products,
  favorites,
  onRemoveFavorite,
  onClearFavorites,
  onAddToCart,
  isPricesVisible = false,
  lang = 'fr',
}) => {
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  const [editing, setEditing] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const items = useMemo(
    () => favorites.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p)),
    [favorites, products]
  );

  useEffect(() => {
    if (!isOpen) {
      setEditing(false);
      setJustAdded(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(null), 1500);
    return () => clearTimeout(timer);
  }, [justAdded]);

  if (!isOpen) return null;

  const qtyOf = (p: Product) => quantities[p.id] ?? defaultAddQuantity(p);
  const setQty = (p: Product, value: number) => {
    const clamped = Math.max(1, Math.min(p.stock || 1, Math.floor(value) || 1));
    setQuantities((prev) => ({ ...prev, [p.id]: clamped }));
  };
  const step = (p: Product) => (p.family === 'Extrait' ? 100 : 1);
  const stepBy = (p: Product, dir: 1 | -1) => {
    const next = qtyOf(p) + dir * step(p);
    const min = Math.min(step(p), p.stock || 1);
    setQty(p, Math.max(min, next));
  };
  const unitLabel = (p: Product) => (p.family === 'Extrait' ? 'g' : tr('وحدة', 'u.'));
  const inStock = (p: Product) => p.stock > 0;

  const addOne = (p: Product) => {
    if (!inStock(p)) return;
    onAddToCart(p, qtyOf(p));
    setJustAdded(p.id);
  };
  const addAll = () => {
    items.filter(inStock).forEach((p) => onAddToCart(p, qtyOf(p)));
    setJustAdded('__all__');
  };
  const availableCount = items.filter(inStock).length;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      dir={isAr ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-label={tr('إدارة المفضلة', 'Gérer mes favoris')}
    >
      <div
        className="bg-white w-full sm:max-w-2xl max-h-[92vh] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <Heart className="w-5 h-5 fill-rose-500 text-rose-500 shrink-0" />
            <h2 className="font-black text-slate-900 truncate">
              {tr('إدارة المفضلة', 'Gérer mes favoris')} ({items.length})
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                  editing ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {editing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                {editing ? tr('تم', 'Terminé') : tr('تعديل', 'Modifier')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label={tr('إغلاق', 'Fermer')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {items.length === 0 ? (
            <div className="py-14 text-center text-slate-500">
              <Heart className="w-10 h-10 mx-auto mb-3 text-rose-200" />
              <p className="font-bold text-slate-800">{tr('لا توجد منتجات في المفضلة', 'Aucun favori pour le moment')}</p>
              <p className="text-sm mt-1">
                {tr('اضغط على القلب في أي منتج لإضافته هنا.', 'Touchez le cœur sur un produit pour le retrouver ici.')}
              </p>
            </div>
          ) : (
            items.map((p) => {
              const details = getProductLocalizedDetails(p, lang);
              const price = calculateDiscountedPrice(p.priceDA, p.discountPercent);
              const qty = qtyOf(p);
              const out = !inStock(p);
              return (
                <div
                  key={p.id}
                  className={`flex gap-3 p-2.5 rounded-xl border ${out ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="w-16 h-16 rounded-lg bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={details.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <Package className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 truncate">{details.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {p.code}
                          {p.brand ? ` · ${p.brand}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveFavorite(p.id)}
                        className={`p-1.5 rounded-lg shrink-0 ${
                          editing ? 'text-white bg-rose-600' : 'text-rose-600 hover:bg-rose-50'
                        }`}
                        title={tr('إزالة من المفضلة', 'Retirer des favoris')}
                        aria-label={tr('إزالة من المفضلة', 'Retirer des favoris')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-black text-[#9f0e4e]">
                        {isPricesVisible
                          ? `${formatDZD(price)}${p.family === 'Extrait' ? ' /g' : ''}`
                          : tr('الأسعار بعد الموافقة', 'Prix après validation')}
                      </span>
                      {out ? (
                        <span className="text-xs font-bold text-slate-500">{tr('نفد المخزون', 'Rupture de stock')}</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              className="p-1.5 hover:bg-slate-100"
                              onClick={() => stepBy(p, -1)}
                              aria-label="-"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={p.stock}
                              value={qty}
                              onChange={(e) => setQty(p, Number(e.target.value))}
                              className="w-12 text-center text-sm font-bold outline-none"
                              aria-label={tr('الكمية', 'Quantité')}
                            />
                            <span className="text-[10px] text-slate-500 pe-1">{unitLabel(p)}</span>
                            <button
                              type="button"
                              className="p-1.5 hover:bg-slate-100"
                              onClick={() => stepBy(p, 1)}
                              aria-label="+"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => addOne(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#9f0e4e] text-white text-xs font-bold hover:opacity-90"
                          >
                            {justAdded === p.id ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                            {justAdded === p.id ? tr('تمت الإضافة', 'Ajouté') : tr('أضف للسلة', 'Ajouter')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(tr('حذف كل المفضلة؟', 'Supprimer tous les favoris ?'))) onClearFavorites();
              }}
              className="text-xs font-bold text-rose-700 hover:underline"
            >
              {tr('حذف الكل', 'Tout supprimer')}
            </button>
            <button
              type="button"
              disabled={availableCount === 0}
              onClick={addAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-40"
            >
              {justAdded === '__all__' ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
              {justAdded === '__all__'
                ? tr('تمت الإضافة', 'Ajouté au panier')
                : tr(`أضف الكل للسلة (${availableCount})`, `Tout ajouter au panier (${availableCount})`)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
