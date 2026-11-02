import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, SlidersHorizontal, X, Sparkles, Layers, Wrench, Heart, Flame, Check, Tag } from 'lucide-react';
import { ProductFamily } from '../types';
import { AppLanguage, translations } from '../translations';
import type { GenderKey } from '../utils/productUtils';

export type StockFilterType = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
export type SortOption = 'default' | 'price_asc' | 'price_desc' | 'stock_desc' | 'name_asc';

interface ProductFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedFamily: ProductFamily | 'all';
  onSelectFamily: (fam: ProductFamily | 'all') => void;
  stockFilter: StockFilterType;
  onSelectStockFilter: (filter: StockFilterType) => void;
  sortOption: SortOption;
  onSelectSortOption: (sort: SortOption) => void;
  totalCount: number;
  filteredCount: number;
  familyCounts: { all: number; Extrait: number; Flacon: number; Accessoire?: number };
  onResetFilters: () => void;
  lang?: AppLanguage;
  favoritesCount?: number;
  showOnlyFavorites?: boolean;
  onToggleOnlyFavorites?: () => void;
  onManageFavorites?: () => void;
  showOnlyTopSellers?: boolean;
  onToggleOnlyTopSellers?: () => void;
  topSellersCount?: number;
  // Gender, brand and clearance filters
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

const tabBase =
  'px-3.5 py-2.5 sm:px-3 sm:py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0';
const tabOn = 'bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white shadow-xs';
const tabOff = 'bg-rose-50/60 text-slate-700 hover:bg-rose-100/60 hover:text-[#9f0e4e]';

const ProductFilterComponent: React.FC<ProductFilterProps> = ({
  searchQuery,
  onSearchChange,
  selectedFamily,
  onSelectFamily,
  stockFilter,
  onSelectStockFilter,
  sortOption,
  onSelectSortOption,
  totalCount,
  filteredCount,
  familyCounts,
  onResetFilters,
  lang = 'ar',
  favoritesCount = 0,
  showOnlyFavorites = false,
  onToggleOnlyFavorites,
  onManageFavorites,
  showOnlyTopSellers = false,
  onToggleOnlyTopSellers,
  topSellersCount = 0,
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
  const L = (fr: string, en: string, ar: string) => (lang === 'ar' ? ar : lang === 'en' ? en : fr);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [brandQuery, setBrandQuery] = useState('');

  const genderTotal = genderCounts.men + genderCounts.women + genderCounts.unisex;
  const hasGenderData = genderTotal > 0 && !!onSelectGender;
  const hasBrands = brandOptions.length > 0 && !!onToggleBrand;

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedFamily !== 'all' ||
    stockFilter !== 'all' ||
    sortOption !== 'default' ||
    showOnlyFavorites ||
    showOnlyTopSellers ||
    showOnlyClearance ||
    genderFilter !== 'all' ||
    selectedBrands.length > 0;

  // Filters that live inside the sheet only (shown as a badge on the button)
  const sheetBadge =
    selectedBrands.length +
    (sortOption !== 'default' ? 1 : 0) +
    (stockFilter !== 'all' ? 1 : 0) +
    (selectedFamily !== 'all' ? 1 : 0) +
    (showOnlyClearance ? 1 : 0);

  // Lock page scroll while the sheet is open and close on Escape
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [sheetOpen]);

  const shownBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    return q ? brandOptions.filter((b) => b.name.toLowerCase().includes(q)) : brandOptions;
  }, [brandOptions, brandQuery]);

  const pickFamily = (fam: ProductFamily | 'all') => {
    onSelectFamily(fam);
    if (showOnlyFavorites && onToggleOnlyFavorites) onToggleOnlyFavorites();
    if (showOnlyTopSellers && onToggleOnlyTopSellers) onToggleOnlyTopSellers();
  };

  const genderLabel = (g: GenderKey | 'all') =>
    g === 'all'
      ? t.filterAll
      : g === 'men'
      ? L('Hommes', 'Men', 'رجال')
      : g === 'women'
      ? L('Femmes', 'Women', 'نساء')
      : L('Mixte', 'Unisex', 'مختلط');

  const familyTabs: { key: ProductFamily | 'all'; label: string; count: number; icon?: React.ReactNode; id?: string }[] = [
    { key: 'all', label: t.filterAll, count: familyCounts.all },
    { key: 'Extrait', label: t.extraitsTitle.split(' ')[0], count: familyCounts.Extrait, icon: <Sparkles className="w-3.5 h-3.5 text-rose-300" /> },
    { key: 'Flacon', label: t.flaconsTitle.split(' ')[0], count: familyCounts.Flacon, icon: <Layers className="w-3.5 h-3.5" /> },
    {
      key: 'Accessoire',
      label: t.accessoriesTitle ? t.accessoriesTitle.split(' ')[0] : 'Accessoires',
      count: familyCounts.Accessoire ?? 0,
      icon: <Wrench className="w-3.5 h-3.5" />,
      id: 'filter-tab-accessoire',
    },
  ];

  const chip = (on: boolean) =>
    `px-3 py-2 rounded-full border text-xs font-bold transition cursor-pointer ${
      on ? 'bg-[#9f0e4e] text-white border-[#9f0e4e]' : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
    }`;

  const sectionTitle = 'text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2';

  const sheet = (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={L('Fermer', 'Close', 'إغلاق')}
        className="absolute inset-0 bg-slate-950/50 cursor-default"
        onClick={() => setSheetOpen(false)}
      />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[80vh]">
        <div className="pt-2.5 pb-1 sm:hidden">
          <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-900">{L('Filtres', 'Filters', 'تصفية')}</h2>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="p-2 -mr-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
            aria-label={L('Fermer', 'Close', 'إغلاق')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {hasGenderData && (
            <section>
              <div className={sectionTitle}>{L('Genre', 'Gender', 'الجنس')}</div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'men', 'women', 'unisex'] as const).map((g) => (
                  <button key={g} type="button" onClick={() => onSelectGender?.(g)} className={chip(genderFilter === g)}>
                    {genderLabel(g)}
                    {g !== 'all' && <span className="opacity-70"> ({genderCounts[g]})</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {hasBrands && (
            <section>
              <div className={sectionTitle}>{L('Marque', 'Brand', 'العلامة')}</div>
              <div className="relative mb-2.5">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="brand-search-input"
                  type="text"
                  value={brandQuery}
                  onChange={(e) => setBrandQuery(e.target.value)}
                  placeholder={L('Rechercher une marque…', 'Search brands…', 'ابحث عن علامة…')}
                  className="w-full pl-9 pr-3 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#9f0e4e]"
                />
              </div>
              <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
                {shownBrands.map((b) => {
                  const on = selectedBrands.includes(b.name);
                  return (
                    <button key={b.name} type="button" onClick={() => onToggleBrand?.(b.name)} className={chip(on)}>
                      {on && <Check className="w-3 h-3 inline -mt-0.5 mr-1" />}
                      {b.name}
                      <span className="opacity-70"> ({b.count})</span>
                    </button>
                  );
                })}
                {shownBrands.length === 0 && (
                  <span className="text-xs text-slate-400">{L('Aucune marque', 'No brand found', 'لا توجد علامة')}</span>
                )}
              </div>
            </section>
          )}

          <section>
            <div className={sectionTitle}>{L('Famille', 'Family', 'الفئة')}</div>
            <div className="flex flex-wrap gap-2">
              {familyTabs.map((f) => (
                <button key={f.key} type="button" onClick={() => pickFamily(f.key)} className={chip(selectedFamily === f.key)}>
                  {f.label} <span className="opacity-70">({f.count})</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className={sectionTitle}>{L('Trier par', 'Sort by', 'ترتيب حسب')}</div>
            <select
              id="sort-select"
              value={sortOption}
              onChange={(e) => onSelectSortOption(e.target.value as SortOption)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-base sm:text-sm font-medium rounded-xl px-3 py-2.5 focus:outline-hidden focus:border-[#9f0e4e] cursor-pointer"
            >
              <option value="default">{L('Recommandés', 'Recommended', 'الموصى به')}</option>
              <option value="price_asc">{t.sortByPriceAsc}</option>
              <option value="price_desc">{t.sortByPriceDesc}</option>
              <option value="stock_desc">🔥 Top Seller</option>
              <option value="name_asc">Nom (A-Z)</option>
            </select>
          </section>

          <section className="space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-bold text-slate-800">✓ {t.filterInStock}</span>
              <input
                type="checkbox"
                checked={stockFilter === 'in_stock'}
                onChange={() => onSelectStockFilter(stockFilter === 'in_stock' ? 'all' : 'in_stock')}
                className="w-5 h-5 accent-[#9f0e4e]"
              />
            </label>
            {onToggleOnlyClearance && (
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-bold text-slate-800">
                  {L('Soldes et déstockage', 'Sale and clearance', 'التخفيضات والتصفية')}
                  {clearanceCount > 0 && <span className="text-slate-400 font-medium"> ({clearanceCount})</span>}
                </span>
                <input
                  type="checkbox"
                  checked={showOnlyClearance}
                  onChange={onToggleOnlyClearance}
                  className="w-5 h-5 accent-[#9f0e4e]"
                />
              </label>
            )}
          </section>
        </div>

        <div
          className="flex gap-2.5 px-5 pt-3 border-t border-slate-100"
          style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={onResetFilters}
            disabled={!hasActiveFilters}
            className="px-4 py-3 rounded-xl text-sm font-bold text-slate-700 border border-slate-200 disabled:opacity-40 cursor-pointer"
          >
            {L('Réinitialiser', 'Reset', 'إعادة ضبط')}
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="flex-1 py-3 rounded-xl text-sm font-black text-white bg-gradient-to-r from-[#70083b] to-[#9f0e4e] cursor-pointer"
          >
            {L(`Voir ${filteredCount} résultats`, `Show ${filteredCount} results`, `عرض ${filteredCount} نتيجة`)}
          </button>
        </div>
      </div>
    </div>
  );

  // Removable chips for the filters applied from inside the sheet
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  selectedBrands.forEach((b) => activeChips.push({ key: `b-${b}`, label: b, onRemove: () => onToggleBrand?.(b) }));
  if (genderFilter !== 'all' && onSelectGender)
    activeChips.push({ key: 'g', label: genderLabel(genderFilter), onRemove: () => onSelectGender('all') });
  if (showOnlyClearance && onToggleOnlyClearance)
    activeChips.push({ key: 'clr', label: L('Soldes', 'Sale', 'تخفيضات'), onRemove: onToggleOnlyClearance });

  return (
    <div
      className="bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:p-4 shadow-2xs border border-rose-100 mb-3 sm:mb-6 space-y-2.5 sm:space-y-3 transition-all"
      dir="ltr"
    >
      {/* Search + Filters button */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 lg:max-w-md">
          <Search className="w-4 h-4 text-rose-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="search-products-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-9 py-3 sm:py-2 text-base sm:text-xs bg-rose-50/30 border border-rose-200/80 rounded-xl text-slate-900 focus:outline-hidden focus:border-[#9f0e4e] focus:ring-2 focus:ring-[#9f0e4e]/10 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#9f0e4e] p-1 cursor-pointer"
              title="Effacer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`relative shrink-0 flex items-center gap-1.5 px-3.5 py-3 sm:px-3 sm:py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${
            sheetBadge > 0
              ? 'border-[#9f0e4e] text-[#9f0e4e] bg-rose-50'
              : 'border-rose-200 text-slate-700 bg-white hover:border-rose-300'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>{L('Filtres', 'Filters', 'تصفية')}</span>
          {sheetBadge > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#9f0e4e] text-white text-[10px] font-black flex items-center justify-center">
              {sheetBadge}
            </span>
          )}
        </button>
      </div>

      {/* Gender segmented control */}
      {hasGenderData && (
        <div className="grid grid-cols-4 gap-1.5">
          {(['all', 'men', 'women', 'unisex'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onSelectGender?.(g)}
              className={`py-2.5 sm:py-1.5 rounded-full border text-xs font-bold transition cursor-pointer ${
                genderFilter === g
                  ? 'bg-[#9f0e4e] text-white border-[#9f0e4e]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
              }`}
            >
              {genderLabel(g)}
            </button>
          ))}
        </div>
      )}

      {/* Desktop: all brands on their own rows */}
      {hasBrands && (
        <div className="hidden sm:flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {brandOptions.map((b) => {
            const on = selectedBrands.includes(b.name);
            return (
              <button key={b.name} type="button" onClick={() => onToggleBrand?.(b.name)} className={chip(on)}>
                {b.name}
                <span className="opacity-70"> ({b.count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Family tabs + quick toggles (scroll sideways on phones) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
        {familyTabs.map((f) => {
          const on = selectedFamily === f.key && !showOnlyFavorites && !showOnlyTopSellers;
          return (
            <button key={f.key} type="button" id={f.id} onClick={() => pickFamily(f.key)} className={`${tabBase} ${on ? tabOn : tabOff}`}>
              {f.icon}
              <span>{f.label}</span>
              <span className="text-[10px] opacity-80">({f.count})</span>
            </button>
          );
        })}

        <span className="w-px h-6 bg-slate-200 shrink-0 mx-0.5" aria-hidden="true" />

        {onToggleOnlyTopSellers && (
          <button
            type="button"
            onClick={onToggleOnlyTopSellers}
            className={`${tabBase} ${
              showOnlyTopSellers
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
            }`}
            title="Afficher uniquement les meilleures ventes (stock élevé)"
          >
            <Flame className={`w-3.5 h-3.5 ${showOnlyTopSellers ? 'fill-slate-950 text-slate-950' : 'text-amber-600'}`} />
            <span>{t.topSellers}</span>
            {topSellersCount > 0 && <span className="text-[10px] opacity-80">({topSellersCount})</span>}
          </button>
        )}

        {onToggleOnlyFavorites && (
          <button
            type="button"
            onClick={onToggleOnlyFavorites}
            className={`${tabBase} ${
              showOnlyFavorites ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
            title={t.onlyFavorites}
          >
            <Heart className={`w-3.5 h-3.5 ${showOnlyFavorites ? 'fill-white' : 'fill-rose-500 text-rose-500'}`} />
            <span>{t.favorites}</span>
            {favoritesCount > 0 && <span className="text-[10px] opacity-80">({favoritesCount})</span>}
          </button>
        )}

        {onManageFavorites && favoritesCount > 0 && (
          <button
            type="button"
            onClick={onManageFavorites}
            className={`${tabBase} bg-white text-rose-800 hover:bg-rose-50 border border-rose-200`}
          >
            <span>{lang === 'ar' ? 'إدارة المفضلة' : 'Gérer favoris'}</span>
          </button>
        )}

        {onToggleOnlyClearance && clearanceCount > 0 && (
          <button
            type="button"
            onClick={onToggleOnlyClearance}
            className={`${tabBase} border ${
              showOnlyClearance ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-300 hover:border-slate-500'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>{L('Soldes', 'Sale', 'تخفيضات')}</span>
            <span className="text-[10px] opacity-80">({clearanceCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onSelectStockFilter(stockFilter === 'in_stock' ? 'all' : 'in_stock')}
          className={`${tabBase} border ${
            stockFilter === 'in_stock'
              ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          ✓ {t.filterInStock}
        </button>
      </div>

      {/* Active filter chips + count + reset */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
        <span className="text-slate-600">
          {t.productsFound} : <strong className="text-slate-950 font-bold">{filteredCount}</strong> / {totalCount}
        </span>
        {activeChips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={c.onRemove}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-rose-50 text-[#9f0e4e] border border-rose-200 font-bold cursor-pointer"
            aria-label={`${L('Retirer', 'Remove', 'إزالة')} ${c.label}`}
          >
            {c.label}
            <X className="w-3 h-3" />
          </button>
        ))}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="ml-auto text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1 hover:underline cursor-pointer px-2 py-1 rounded-md hover:bg-amber-50"
          >
            <X className="w-3.5 h-3.5" />
            <span>{L('Réinitialiser', 'Reset', 'إعادة ضبط')}</span>
          </button>
        )}
      </div>

      {sheetOpen && typeof document !== 'undefined' && createPortal(sheet, document.body)}
    </div>
  );
};

export const ProductFilter = React.memo(ProductFilterComponent);
