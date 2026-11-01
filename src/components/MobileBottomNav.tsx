import React from 'react';
import { Loader2, LayoutGrid, Sparkles, Heart, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  currentInterface: 'showroom' | 'quick';
  isSwitching?: boolean;
  onSelectInterface: (mode: 'showroom' | 'quick') => void;
  cartCount?: number;
  cartTotalDA?: number;
  isPricesVisible?: boolean;
  onOpenCart?: () => void;
  lang?: string;
  favoritesCount?: number;
  savedActive?: boolean;
  onOpenSaved?: () => void;
  onOpenMenu?: () => void;
}

/** Thumb-reach navigation for phones: catalogue, quick order, favorites and the menu. */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentInterface,
  isSwitching = false,
  onSelectInterface,
  lang = 'fr',
  favoritesCount = 0,
  savedActive = false,
  onOpenSaved,
  onOpenMenu,
}) => {
  const tr = (ar: string, fr: string) => (lang === 'ar' ? ar : fr);
  const tab = (active: boolean) =>
    `flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-xs font-bold transition cursor-pointer ${
      active ? 'text-[#9f0e4e]' : 'text-slate-500'
    }`;

  return (
    <nav
      aria-label="Navigation"
      dir="ltr"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-rose-200 shadow-[0_-4px_16px_rgba(80,4,40,0.08)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch gap-1 px-2">
        <button
          type="button"
          className={tab(currentInterface === 'showroom')}
          onClick={() => {
            onSelectInterface('showroom');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          {isSwitching && currentInterface === 'showroom' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {tr('الكتالوج', 'Catalogue')}
        </button>
        <button
          type="button"
          className={tab(currentInterface === 'quick')}
          onClick={() => {
            onSelectInterface('quick');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          {isSwitching && currentInterface === 'quick' ? <Loader2 className="w-5 h-5 animate-spin" /> : <LayoutGrid className="w-5 h-5" />}
          {tr('طلب سريع', 'Rapide')}
        </button>
        {onOpenSaved && (
          <button type="button" className={tab(savedActive)} onClick={onOpenSaved}>
            <span className="relative">
              <Heart className={`w-5 h-5 ${savedActive ? 'fill-current' : ''}`} />
              {favoritesCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#9f0e4e] text-white text-[9px] font-black flex items-center justify-center">
                  {favoritesCount}
                </span>
              )}
            </span>
            {tr('المفضلة', 'Favoris')}
          </button>
        )}
        {onOpenMenu && (
          <button type="button" className={tab(false)} onClick={onOpenMenu}>
            <Menu className="w-5 h-5" />
            {tr('القائمة', 'Menu')}
          </button>
        )}
      </div>
    </nav>
  );
};
