import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, SlidersHorizontal, Tag, X } from 'lucide-react';
import type { AppLanguage } from '../translations';
import type { GenderKey } from '../utils/productUtils';

interface BrandGenderFiltersProps {
  lang: AppLanguage;
  genderFilter: GenderKey | 'all';
  onSelectGender: (g: GenderKey | 'all') => void;
  genderCounts: { men: number; women: number; unisex: number };
  brandOptions: { name: string; count: number }[];
  selectedBrands: string[];
  onToggleBrand: (brand: string) => void;
  showOnlyClearance: boolean;
  onToggleOnlyClearance: () => void;
  clearanceCount: number;
  resultCount: number;
}

/** Gender buttons + brand/sale sheet, same filters and wording as the catalogue. */
export const BrandGenderFilters: React.FC<BrandGenderFiltersProps> = ({
  lang,
  genderFilter,
  onSelectGender,
  genderCounts,
  brandOptions,
  selectedBrands,
  onToggleBrand,
  showOnlyClearance,
  onToggleOnlyClearance,
  clearanceCount,
  resultCount,
}) => {
  const L = (fr: string, en: string, ar: string) => (lang === 'ar' ? ar : lang === 'en' ? en : fr);
  const [open, setOpen] = useState(false);
  const [brandQuery, setBrandQuery] = useState('');

  const hasGender = genderCounts.men + genderCounts.women + genderCounts.unisex > 0;
  const hasBrands = brandOptions.length > 0;
  const badge = selectedBrands.length + (showOnlyClearance ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const shownBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    return q ? brandOptions.filter((b) => b.name.toLowerCase().includes(q)) : brandOptions;
  }, [brandOptions, brandQuery]);

  if (!hasGender && !hasBrands && clearanceCount === 0) return null;

  const genderLabel = (g: GenderKey | 'all') =>
    g === 'all'
      ? L('Tous', 'All', 'الكل')
      : g === 'men'
      ? L('Hommes', 'Men', 'رجال')
      : g === 'women'
      ? L('Femmes', 'Women', 'نساء')
      : L('Mixte', 'Unisex', 'مختلط');

  const chip = (on: boolean) =>
    `px-3 py-2 rounded-full border text-xs font-bold transition cursor-pointer ${
      on ? 'bg-[#9f0e4e] text-white border-[#9f0e4e]' : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
    }`;
  const title = 'text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2';

  const reset = () => {
    onSelectGender('all');
    selectedBrands.forEach(onToggleBrand);
    if (showOnlyClearance) onToggleOnlyClearance();
  };
  const hasActive = genderFilter !== 'all' || badge > 0;

  const sheet = (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" dir="ltr">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/50 cursor-default" onClick={() => setOpen(false)} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[80vh]">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-900">{L('Filtres', 'Filters', 'تصفية')}</h2>
          <button type="button" onClick={() => setOpen(false)} className="p-2 -mr-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {hasBrands && (
            <section>
              <div className={title}>{L('Marque', 'Brand', 'العلامة')}</div>
              <div className="relative mb-2.5">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={brandQuery}
                  onChange={(e) => setBrandQuery(e.target.value)}
                  placeholder={L('Rechercher une marque…', 'Search brands…', 'ابحث عن علامة…')}
                  className="w-full pl-9 pr-3 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#9f0e4e]"
                />
              </div>
              <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
                {shownBrands.map((b) => {
                  const on = selectedBrands.includes(b.name);
                  return (
                    <button key={b.name} type="button" onClick={() => onToggleBrand(b.name)} className={chip(on)}>
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
          {clearanceCount > 0 && (
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-bold text-slate-800">
                {L('Soldes et déstockage', 'Sale and clearance', 'التخفيضات والتصفية')}
                <span className="text-slate-400 font-medium"> ({clearanceCount})</span>
              </span>
              <input type="checkbox" checked={showOnlyClearance} onChange={onToggleOnlyClearance} className="w-5 h-5 accent-[#9f0e4e]" />
            </label>
          )}
        </div>
        <div className="flex gap-2.5 px-5 pt-3 border-t border-slate-100" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))' }}>
          <button type="button" onClick={reset} disabled={!hasActive} className="px-4 py-3 rounded-xl text-sm font-bold text-slate-700 border border-slate-200 disabled:opacity-40 cursor-pointer">
            {L('Réinitialiser', 'Reset', 'إعادة ضبط')}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="flex-1 py-3 rounded-xl text-sm font-black text-white bg-gradient-to-r from-[#70083b] to-[#9f0e4e] cursor-pointer">
            {L(`Voir ${resultCount} résultats`, `Show ${resultCount} results`, `عرض ${resultCount} نتيجة`)}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full sm:w-auto space-y-2" dir="ltr">
      <div className="flex items-center gap-2">
        {hasGender && (
          <div className="grid grid-cols-4 gap-1.5 flex-1 sm:flex-none">
            {(['all', 'men', 'women', 'unisex'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onSelectGender(g)}
                className={`py-2.5 sm:py-1.5 sm:px-3 rounded-full border text-xs font-bold transition cursor-pointer ${
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
        {(hasBrands || clearanceCount > 0) && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`relative shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition ${
              badge > 0 ? 'border-[#9f0e4e] text-[#9f0e4e] bg-rose-50' : 'border-rose-200 text-slate-700 bg-white hover:border-rose-300'
            }`}
          >
            {showOnlyClearance && badge === 1 ? <Tag className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
            <span>{L('Marque', 'Brand', 'العلامة')}</span>
            {badge > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#9f0e4e] text-white text-[10px] font-black flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        )}
      </div>
      {selectedBrands.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedBrands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onToggleBrand(b)}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-rose-50 text-[#9f0e4e] border border-rose-200 text-xs font-bold cursor-pointer"
            >
              {b}
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}
      {open && typeof document !== 'undefined' && createPortal(sheet, document.body)}
    </div>
  );
};
