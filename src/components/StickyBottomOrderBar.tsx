import React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { CartItem, LoyaltyTier, OffersConfig } from '../types';
import { computeCart } from '../utils/offers';
import { AppLanguage, translations } from '../translations';
import { formatDZD } from '../utils/formatDZD';

interface StickyBottomOrderBarProps {
  cart: CartItem[];
  isPricesVisible: boolean;
  lang?: AppLanguage;
  onOpenCart: () => void;
  offers?: OffersConfig | null;
  loyaltyTier?: LoyaltyTier | null;
}

export const StickyBottomOrderBar: React.FC<StickyBottomOrderBarProps> = ({
  cart,
  isPricesVisible,
  lang = 'ar',
  onOpenCart,
  offers = null,
  loyaltyTier = null,
}) => {
  const t = translations[lang];
  const isRtl = false; // Layout stays LTR for accessibility and right-handed reachability

  const validCart = cart.filter((item) => item && item.product && typeof item.quantity === 'number');
  if (validCart.length === 0) return null;

  const totalPriceDA = computeCart(validCart, offers, loyaltyTier).totalDA;

  return (
    <aside
      aria-label="Récapitulatif de votre commande"
      className="max-sm:hidden fixed bottom-0 inset-x-0 bg-gradient-to-r from-[#400320]/95 via-[#500428]/95 to-[#240313]/95 backdrop-blur-md text-white border-t border-[#70083b]/70 py-2.5 sm:py-3 px-3 sm:px-4 z-40 shadow-2xl"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-white/20 text-white font-black shrink-0 border border-white/25 shadow-xs">
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-rose-100" />
          </div>
          <div className="min-w-0">
            {/* Total Price Display */}
            <div className="text-xs font-mono font-extrabold flex items-center gap-1.5 mt-0.5">
              {isPricesVisible ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs text-rose-200 font-sans font-bold">
                    {lang === 'ar' ? 'المجموع :' : 'Total :'}
                  </span>
                  <span className="text-rose-300 text-sm sm:text-base font-black tracking-tight">
                    {formatDZD(totalPriceDA)}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-rose-200/80 font-sans font-normal truncate">
                  {t.totalHiddenNotice}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-sticky-bar-cart"
            type="button"
            onClick={onOpenCart}
            className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#9f0e4e] via-[#c2185b] to-[#e91e63] hover:opacity-95 text-white font-black text-xs flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-rose-950/40 cursor-pointer transition border border-rose-300/30"
          >
            <span>{t.cartBtn}</span>
            <span className="bg-black/30 text-rose-100 px-1.5 py-0.5 rounded-full text-[11px]">
              {cart.length}
            </span>
            {isPricesVisible && (
              <span className="text-white font-mono text-xs font-bold hidden xs:inline sm:inline">
                • {formatDZD(totalPriceDA)}
              </span>
            )}
            <ArrowRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-100 ${isRtl ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </aside>
  );
};
