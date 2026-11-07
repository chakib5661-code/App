import React from 'react';
import { Tag, ArrowRight, X } from 'lucide-react';
import { AppLanguage } from '../translations';

interface ClearanceBannerProps {
  count: number;
  maxDiscount: number;
  /** ISO date when the sale ends (earliest end among clearance products), if any */
  endsAt?: string | null;
  active: boolean;
  onToggle: () => void;
  lang?: AppLanguage;
}

/** Entry point to the sale products: shows how many items, the best discount and the end date. */
export const ClearanceBanner: React.FC<ClearanceBannerProps> = ({ count, maxDiscount, endsAt, active, onToggle, lang = 'fr' }) => {
  if (count <= 0) return null;
  const L = (fr: string, en: string, ar: string) => (lang === 'ar' ? ar : lang === 'en' ? en : fr);

  let endLabel = '';
  if (endsAt) {
    const d = new Date(endsAt);
    if (!isNaN(d.getTime()) && d.getTime() > Date.now()) {
      const locale = lang === 'ar' ? 'ar-DZ' : lang === 'en' ? 'en-GB' : 'fr-DZ';
      endLabel = L('Jusqu’au ', 'Until ', 'حتى ') + d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
    }
  }

  return (
    <section
      dir="ltr"
      aria-label={L('Soldes et déstockage', 'Sale and clearance', 'التخفيضات والتصفية')}
      className="mb-3 sm:mb-5 rounded-2xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] text-white px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-3 shadow-md"
    >
      <div className="min-w-0 flex items-center gap-3">
        <span className="hidden sm:flex w-10 h-10 rounded-xl bg-white/15 items-center justify-center shrink-0">
          <Tag className="w-5 h-5" />
        </span>
        <div className="min-w-0" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-100">
            {L('Soldes et déstockage', 'Sale and clearance', 'التخفيضات والتصفية')}
          </div>
          <div className="text-lg sm:text-xl font-black leading-tight">
            {maxDiscount > 0 ? (
              <>
                {L('Jusqu’à ', 'Up to ', 'خصم يصل إلى ')}
                <bdi dir="ltr">-{maxDiscount}%</bdi>
              </>
            ) : (
              L('Prix réduits', 'Reduced prices', 'أسعار مخفضة')
            )}
          </div>
          <div className="text-xs text-rose-100/90 truncate">
            {count} {L('produits', 'products', 'منتج')}
            {endLabel ? ` · ${endLabel}` : ''}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          onToggle();
          if (!active && typeof document !== 'undefined') {
            document.getElementById('search-products-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
        className="shrink-0 px-4 py-2.5 rounded-xl bg-white text-[#9f0e4e] text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
      >
        {active ? (
          <>
            <X className="w-3.5 h-3.5" />
            {L('Voir tout', 'Show all', 'عرض الكل')}
          </>
        ) : (
          <>
            {L('Voir les soldes', 'Shop the sale', 'تسوق التخفيضات')}
            <ArrowRight className="w-3.5 h-3.5" />
          </>
        )}
      </button>
    </section>
  );
};
