import React from 'react';
import { Search, SlidersHorizontal, X, Sparkles, Layers, Wrench, Heart, Flame } from 'lucide-react';
import { ProductFamily } from '../types';
import { AppLanguage, translations } from '../translations';

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
  showOnlyTopSellers?: boolean;
  onToggleOnlyTopSellers?: () => void;
  topSellersCount?: number;
}

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
  showOnlyTopSellers = false,
  onToggleOnlyTopSellers,
  topSellersCount = 0,
}) => {
  const t = translations[lang];
  const isRtl = false; // Layout stays LTR for accessibility and right-handed reachability
  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedFamily !== 'all' ||
    stockFilter !== 'all' ||
    sortOption !== 'default' ||
    showOnlyFavorites ||
    showOnlyTopSellers;

  return (
    <div
      className="sticky top-[58px] z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 shadow-2xs border border-rose-100 mb-4 sm:mb-6 space-y-3 transition-all"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top Flex Row: Search + Family Tabs + Quick Filters */}
      <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
        {/* Search Input - Matching Quick Order */}
        <div className="relative w-full lg:max-w-md">
          <Search className={`w-4 h-4 text-rose-400 absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 pointer-events-none`} />
          <input
            id="search-products-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.searchPlaceholder}
            className={`w-full ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 text-xs bg-rose-50/30 border border-rose-200/80 rounded-xl text-slate-900 focus:outline-hidden focus:border-[#9f0e4e] focus:ring-2 focus:ring-[#9f0e4e]/10 focus:bg-white transition`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className={`absolute ${isRtl ? 'left-2.5' : 'right-2.5'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#9f0e4e] text-xs cursor-pointer p-1`}
              title="Effacer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Family Tabs & Quick Selection Filters (Top Seller, Favorites, In Stock) */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* All */}
          <button
            type="button"
            onClick={() => {
              onSelectFamily('all');
              if (showOnlyFavorites && onToggleOnlyFavorites) onToggleOnlyFavorites();
              if (showOnlyTopSellers && onToggleOnlyTopSellers) onToggleOnlyTopSellers();
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              selectedFamily === 'all' && !showOnlyFavorites && !showOnlyTopSellers
                ? 'bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white shadow-xs'
                : 'bg-rose-50/60 text-slate-700 hover:bg-rose-100/60 hover:text-[#9f0e4e]'
            }`}
          >
            {t.filterAll} ({familyCounts.all})
          </button>

          {/* Extraits */}
          <button
            type="button"
            onClick={() => {
              onSelectFamily('Extrait');
              if (showOnlyFavorites && onToggleOnlyFavorites) onToggleOnlyFavorites();
              if (showOnlyTopSellers && onToggleOnlyTopSellers) onToggleOnlyTopSellers();
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
              selectedFamily === 'Extrait' && !showOnlyFavorites && !showOnlyTopSellers
                ? 'bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white shadow-xs'
                : 'bg-rose-50/60 text-slate-700 hover:bg-rose-100/60 hover:text-[#9f0e4e]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-300" />
            <span>{t.extraitsTitle.split(' ')[0]}</span>
            <span className="text-[10px] opacity-80">({familyCounts.Extrait})</span>
          </button>

          {/* Flacons */}
          <button
            type="button"
            onClick={() => {
              onSelectFamily('Flacon');
              if (showOnlyFavorites && onToggleOnlyFavorites) onToggleOnlyFavorites();
              if (showOnlyTopSellers && onToggleOnlyTopSellers) onToggleOnlyTopSellers();
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
              selectedFamily === 'Flacon' && !showOnlyFavorites && !showOnlyTopSellers
                ? 'bg-gradient-to-r from-[#880e4f] to-[#be185d] text-white shadow-xs font-black'
                : 'bg-rose-50/60 text-slate-700 hover:bg-rose-100/60 hover:text-[#9f0e4e]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.flaconsTitle.split(' ')[0]}</span>
            <span className="text-[10px] opacity-80">({familyCounts.Flacon})</span>
          </button>

          {/* Accessoires */}
          <button
            type="button"
            id="filter-tab-accessoire"
            onClick={() => {
              onSelectFamily('Accessoire');
              if (showOnlyFavorites && onToggleOnlyFavorites) onToggleOnlyFavorites();
              if (showOnlyTopSellers && onToggleOnlyTopSellers) onToggleOnlyTopSellers();
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
              selectedFamily === 'Accessoire' && !showOnlyFavorites && !showOnlyTopSellers
                ? 'bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white shadow-xs font-black'
                : 'bg-rose-50/60 text-slate-700 hover:bg-rose-100/60 hover:text-[#9f0e4e]'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>{t.accessoriesTitle ? t.accessoriesTitle.split(' ')[0] : 'Accessoires'}</span>
            <span className="text-[10px] opacity-80">({familyCounts.Accessoire ?? 0})</span>
          </button>

          {/* TOP SELLER Filter Toggle */}
          {onToggleOnlyTopSellers && (
            <button
              type="button"
              onClick={onToggleOnlyTopSellers}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                showOnlyTopSellers
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-xs ring-2 ring-amber-400/40'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
              }`}
              title="Afficher uniquement les meilleures ventes (stock élevé)"
            >
              <Flame className={`w-3.5 h-3.5 ${showOnlyTopSellers ? 'fill-slate-950 text-slate-950' : 'text-amber-600'}`} />
              <span>{t.topSellers}</span>
              {topSellersCount > 0 && <span className="text-[10px] opacity-80">({topSellersCount})</span>}
            </button>
          )}

          {/* Favorites Filter Toggle */}
          {onToggleOnlyFavorites && (
            <button
              type="button"
              onClick={onToggleOnlyFavorites}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                showOnlyFavorites
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
              title={t.onlyFavorites}
            >
              <Heart className={`w-3.5 h-3.5 ${showOnlyFavorites ? 'fill-white' : 'fill-rose-500 text-rose-500'}`} />
              <span>{t.favorites}</span>
              {favoritesCount > 0 && <span className="text-[10px] opacity-80">({favoritesCount})</span>}
            </button>
          )}

          {/* In Stock toggle */}
          <button
            type="button"
            onClick={() => onSelectStockFilter(stockFilter === 'in_stock' ? 'all' : 'in_stock')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer whitespace-nowrap ${
              stockFilter === 'in_stock'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            ✓ {t.filterInStock}
          </button>
          {/* Sort select & Reset */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              id="sort-select"
              value={sortOption}
              onChange={(e) => onSelectSortOption(e.target.value as SortOption)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-2.5 py-1 focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="default">
                {lang === 'ar' ? 'الترتيب:   ' : lang === 'en' ? 'Sort:  ' : 'Tri :  '}
              </option>
              <option value="price_asc">{t.sortByPriceAsc}</option>
              <option value="price_desc">{t.sortByPriceDesc}</option>
              <option value="stock_desc">🔥 Top Seller (Top Seller)</option>
              <option value="name_asc">Nom (A-Z)</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1 hover:underline cursor-pointer px-2 py-1 rounded-md hover:bg-amber-50"
            >
              <X className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'إعادة ضبط' : lang === 'en' ? 'Reset' : 'Réinitialiser'}</span>
            </button>
          )}
        </div>
        </div>
      </div>

      {/* Sub-bar: Sorting, Detailed Status, Count & Reset */}
      <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Results count & status */}
        <div className="flex items-center gap-2 text-slate-600">
          <span>
            {t.productsFound} : <strong className="text-slate-950 font-bold">{filteredCount}</strong> / {totalCount}
          </span>
          {showOnlyTopSellers && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold">
              <Flame className="w-3 h-3 text-amber-700" />
              Filtre Top Ventes actif
            </span>
          )}
          {showOnlyFavorites && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 text-[11px] font-bold">
              <Heart className="w-3 h-3 fill-rose-600 text-rose-600" />
              Filtre Favoris actif
            </span>
          )}
        </div>

        
      </div>
    </div>
  );
};

export const ProductFilter = React.memo(ProductFilterComponent);
