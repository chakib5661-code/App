import React from 'react';
import { Loader2, LayoutGrid, ShoppingBag, Sparkles } from 'lucide-react';
import { formatDZD } from '../utils/formatDZD';

interface MobileBottomNavProps {
  currentInterface: 'showroom' | 'quick';
  isSwitching?: boolean;
  onSelectInterface: (mode: 'showroom' | 'quick') => void;
  cartCount: number;
  cartTotalDA: number;
  isPricesVisible: boolean;
  onOpenCart: () => void;
  lang?: string;
}

/** Thumb-reach navigation for phones: catalogue, quick order and the cart with its running total. */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentInterface,
  isSwitching = false,
  onSelectInterface,
  cartCount,
  cartTotalDA,
  isPricesVisible,
  onOpenCart,
  lang = 'fr',
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
        <button
          id="btn-bottom-nav-cart"
          type="button"
          onClick={onOpenCart}
          className="flex-[1.6] my-1.5 rounded-2xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] text-white flex items-center justify-center gap-2 min-h-[48px] px-3 shadow-md active:scale-95 transition cursor-pointer"
        >
          <span className="relative">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[#9f0e4e] text-[10px] font-black flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </span>
          <span className="text-sm font-black truncate">
            {cartCount > 0 && isPricesVisible ? formatDZD(cartTotalDA) : tr('السلة', 'Panier')}
          </span>
        </button>
      </div>
    </nav>
  );
};
