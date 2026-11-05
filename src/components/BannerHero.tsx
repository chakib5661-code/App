import React from 'react';
import { LayoutGrid, Layers, Sparkles, Truck, PackageCheck, Phone, Wrench } from 'lucide-react';
import type { ProductFamily } from '../types';

interface BannerHeroProps {
  imageUrl: string;
  lang: string;
  activeFamily: ProductFamily | 'all';
  onSelectFamily: (fam: ProductFamily | 'all') => void;
  familyCounts: { Extrait: number; Flacon: number; Accessoire: number };
  totalCount: number;
  onQuickOrder: () => void;
  /** Id of the element the banner's own "Découvrir nos produits" button scrolls to. */
  scrollTargetId?: string;
}

const L = (lang: string, fr: string, ar: string, en = fr) => (lang === 'ar' ? ar : lang === 'en' ? en : fr);

/**
 * Full-width advertising banner at the top of the storefront. The logo and title are part of the picture.
 * The header controls (login, cart, theme) float on its top right (see Header `overlay`), the family
 * buttons on its bottom right.
 */
export const BannerHero: React.FC<BannerHeroProps> = ({
  imageUrl,
  lang,
  activeFamily,
  onSelectFamily,
  familyCounts,
  totalCount,
  onQuickOrder,
  scrollTargetId = 'catalogue',
}) => {
  const pill = (on: boolean) =>
    `px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold border backdrop-blur-sm shadow-sm cursor-pointer transition whitespace-nowrap flex items-center gap-1 ${
      on ? 'bg-[#9f0e4e] text-white border-[#c2185b]' : 'bg-white/90 text-[#70083b] border-white hover:bg-white'
    }`;

  const goCatalogue = () => {
    const el = document.getElementById(scrollTargetId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section aria-label="Tulip" className="relative">
      <div className="relative bg-[#fdf2f6]">
        <img
          src={imageUrl}
          alt="Tulip Fragrance Company - Matières Premières de Parfumerie"
          fetchPriority="high"
          decoding="async"
          draggable={false}
          className="block w-full h-auto select-none"
          /* phones show the whole picture (brand and title included); the filter chips below already cover the families */
        />

        {/* The banner's own call-to-action button, made clickable (desktop and tablet, where it is visible) */}
        <button
          type="button"
          onClick={goCatalogue}
          aria-label={L(lang, 'Découvrir nos produits', 'اكتشف منتجاتنا')}
          className="max-sm:hidden absolute left-[4.2%] top-[82%] w-[16.5%] h-[10.5%] rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
        />

        {/* Family buttons on the picture, bottom right */}
        <div className="max-sm:hidden absolute right-4 bottom-4 flex flex-wrap gap-2 justify-end max-w-[62%]">
          <button type="button" id="nav-family-all" className={pill(activeFamily === 'all')} onClick={() => onSelectFamily('all')}>
            {L(lang, 'Tous', 'الكل')} <span className="opacity-70">({totalCount})</span>
          </button>
          <button type="button" id="nav-family-extrait" className={pill(activeFamily === 'Extrait')} onClick={() => onSelectFamily('Extrait')}>
            <Sparkles className="w-3 h-3" />
            {L(lang, 'Extraits', 'الزيوت')} <span className="opacity-70">({familyCounts.Extrait})</span>
          </button>
          <button type="button" id="nav-family-flacon" className={pill(activeFamily === 'Flacon')} onClick={() => onSelectFamily('Flacon')}>
            <Layers className="w-3 h-3" />
            {L(lang, 'Flacons', 'القوارير')} <span className="opacity-70">({familyCounts.Flacon})</span>
          </button>
          <button
            type="button"
            id="nav-family-accessoire"
            className={pill(activeFamily === 'Accessoire')}
            onClick={() => onSelectFamily('Accessoire')}
          >
            <Wrench className="w-3 h-3" />
            {L(lang, 'Accessoires', 'الإكسسوارات')} <span className="opacity-70">({familyCounts.Accessoire})</span>
          </button>
          <button type="button" className={pill(false)} onClick={onQuickOrder}>
            <LayoutGrid className="w-3 h-3" />
            {L(lang, 'Commande rapide', 'الطلب السريع')}
          </button>
        </div>
      </div>

      {/* Delivery and express information that used to sit in the dark hero */}
      <div className="bg-[#3b0a1d] text-rose-100 text-[11px] sm:text-xs px-3 py-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        <span className="flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-rose-300 shrink-0" />
          {L(lang, 'Livraison 58 Wilayas (Yalidine / Domicile / Magasin)', 'التوصيل إلى 58 ولاية', 'Delivery to 58 wilayas')}
        </span>
        <span className="max-sm:hidden flex items-center gap-1.5">
          <PackageCheck className="w-3.5 h-3.5 text-rose-300 shrink-0" />
          {L(lang, 'Réservation express 48H · Stock réel', 'حجز سريع 48 ساعة · مخزون حقيقي', 'Express reservation 48H · Real stock')}
        </span>
        <span className="max-sm:hidden flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-rose-300 shrink-0" />
          Telegram &amp; Vente : <strong className="text-white">+213 799 93 83 99</strong>
        </span>
      </div>
    </section>
  );
};
