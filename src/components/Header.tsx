import React from 'react';
import {
  ShoppingBag,
  FileSpreadsheet,
  Layers,
  Wrench,
  Sparkles,
  PackageCheck,
  Lock,
  LogOut,
  Building2,
  ShieldCheck,
  Truck,
  LayoutGrid,
  User,
  WifiOff,
} from 'lucide-react';
import { ProductFamily, StoreSettings, CustomerUser } from '../types';
import { INITIAL_STORE_SETTINGS } from '../data/initialProducts';
import { formatDZD } from '../utils/pdfGenerator';
import { TulipLogo } from './TulipLogo';
import { AppLanguage, translations } from '../translations';

interface HeaderProps {
  storeSettings?: StoreSettings;
  activeFamily: ProductFamily | 'all';
  onSelectFamily: (fam: ProductFamily | 'all') => void;
  cartCount: number;
  cartTotalDA: number;
  onOpenCart: () => void;
  onOpenExcelSync: () => void;
  onOpenOrders: () => void;
  ordersCount: number;
  lastStockSyncDate?: string;
  isAdminMode?: boolean;
  onToggleAdminMode?: () => void;
  onNavigateToAdmin?: () => void;
  currentCustomer?: CustomerUser | null;
  onOpenCustomerAuth?: (initialTab?: 'login' | 'register') => void;
  onLogoutCustomer?: () => void;
  isPricesVisible?: boolean;
  lang?: AppLanguage;
  onSelectLanguage?: (lang: AppLanguage) => void;
  onOpenOrderTracking?: () => void;
  currentInterface?: 'showroom' | 'quick';
  onToggleInterface?: (mode: 'showroom' | 'quick') => void;
  onOpenInterfaceChoiceModal?: () => void;
  isOnline?: boolean;
  cachedImagesCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeFamily,
  onSelectFamily,
  cartCount,
  cartTotalDA,
  onOpenCart,
  onOpenExcelSync,
  onOpenOrders,
  ordersCount,
  isAdminMode = false,
  onToggleAdminMode,
  currentCustomer,
  onOpenCustomerAuth,
  onLogoutCustomer,
  isPricesVisible = false,
  lang = 'ar',
  onSelectLanguage,
  onOpenOrderTracking,
  currentInterface = 'showroom',
  onToggleInterface,
  isOnline = true,
  cachedImagesCount = 0,
}) => {
  const t = translations[lang];
  const isRtl = false; // Layout stays LTR for accessibility and right-handed reachability

  // Scroll detection to hide switch mode button bar when scrolling
  const [isScrolledDown, setIsScrolledDown] = React.useState(false);

  React.useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > 40) {
        setIsScrolledDown(true);
      } else {
        setIsScrolledDown(false);
      }
      lastY = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-rose-100/90 text-slate-800 shadow-xs transition-all" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Offline Status Bar */}
      {!isOnline && (
        <div className="bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-2 border-b border-[#5a052e] shadow-xs">
          <WifiOff className="w-3.5 h-3.5 text-rose-200 shrink-0" />
          <span>
            {isRtl
              ? `الوضع غير المتصل نشط • الكتالوج والصور  متاحة للطلب دون إنترنت`
              : `Mode Hors-Ligne • Catalogue & photos  prêts pour vos commandes`}
          </span>
        </div>
      )}
      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* Brand & Tulip Logo */}
        <div className="flex items-center gap-3">
          <TulipLogo variant="horizontal" size="md" theme="light" />
        </div>

        {/* Product Family Filter Navigation (Desktop only) */}
        <div className="hidden lg:flex items-center bg-rose-50/70 p-1 rounded-xl border border-rose-100/90">
          <button
            id="nav-family-all"
            type="button"
            onClick={() => onSelectFamily('all')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeFamily === 'all'
                ? 'bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white font-black shadow-xs'
                : 'text-slate-700 hover:text-[#9f0e4e] hover:bg-white/80'
            }`}
          >
            {t.allProducts}
          </button>
          <button
            id="nav-family-extrait"
            type="button"
            onClick={() => onSelectFamily('Extrait')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeFamily === 'Extrait'
                ? 'bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white font-black shadow-xs'
                : 'text-slate-700 hover:text-[#9f0e4e] hover:bg-white/80'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-300" />
            {t.extraitsTitle}
          </button>
          <button
            id="nav-family-flacon"
            type="button"
            onClick={() => onSelectFamily('Flacon')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeFamily === 'Flacon'
                ? 'bg-gradient-to-r from-[#880e4f] to-[#be185d] text-white shadow-xs font-black'
                : 'text-slate-700 hover:text-[#9f0e4e] hover:bg-white/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {t.flaconsTitle}
          </button>
          <button
            id="nav-family-accessoire"
            type="button"
            onClick={() => onSelectFamily('Accessoire')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeFamily === 'Accessoire'
                ? 'bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white shadow-xs font-black'
                : 'text-slate-700 hover:text-[#9f0e4e] hover:bg-white/80'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            {t.accessoriesTitle}
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* CUSTOMER AUTHENTICATION STATUS */}
          {currentCustomer ? (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-pink-50 border border-pink-200/90 px-2 sm:px-3 py-1.5 rounded-xl text-xs">
              <User className="w-3.5 h-3.5 text-[#9f0e4e] shrink-0" />
              <span className="hidden sm:inline text-[#70083b] font-bold max-w-[100px] sm:max-w-[140px] truncate">
                {currentCustomer.username}
              </span>
              {onLogoutCustomer && (
                <button
                  type="button"
                  onClick={onLogoutCustomer}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-pink-100/60 transition cursor-pointer"
                  title={t.logoutBtn}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {onOpenCustomerAuth && (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenCustomerAuth('login')}
                    className="px-2.5 sm:px-3 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-[#880e4f] border border-pink-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    title={t.loginBtn}
                  >
                    <Lock className="w-3.5 h-3.5 text-[#9f0e4e]" />
                    <span className="hidden sm:inline">{t.loginBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenCustomerAuth('register')}
                    className="hidden md:flex px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-[#880e4f] border border-rose-200 text-xs font-bold items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <Building2 className="w-3.5 h-3.5 text-[#9f0e4e]" />
                    <span>{t.requestAccessBtn}</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* ADMIN TOOLS: STRICTLY HIDDEN UNLESS isAdminMode is TRUE */}
          {isAdminMode && (
            <>
              <button
                id="btn-admin-orders"
                type="button"
                onClick={onOpenOrders}
                className="relative px-2.5 py-2 text-xs font-bold rounded-xl bg-rose-50 hover:bg-rose-100 text-[#880e4f] border border-rose-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Consulter les commandes reçues"
              >
                <PackageCheck className="w-4 h-4 text-[#9f0e4e]" />
                <span className="hidden sm:inline">Commandes</span>
                {ordersCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-[#9f0e4e] text-white rounded-full text-[10px] font-bold">
                    {ordersCount}
                  </span>
                )}
              </button>

              <button
                id="btn-excel-sync"
                type="button"
                onClick={onOpenExcelSync}
                className="px-2.5 py-2 text-xs font-semibold rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs transition flex items-center gap-1.5 border border-emerald-600 cursor-pointer"
                title="Importer le fichier Excel POS"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                <span className="hidden sm:inline">Excel</span>
              </button>
            </>
          )}

          {/* ORDER TRACKING BUTTON (Placed Next to Cart Button) */}
          {onOpenOrderTracking && (
            <button
              id="btn-header-track-order"
              type="button"
              onClick={onOpenOrderTracking}
              className="px-2.5 sm:px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-[#880e4f] border border-rose-200/90 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title={t.trackOrderBtn}
            >
              <Truck className="w-4 h-4 text-[#9f0e4e]" />
              <span className="hidden sm:inline">{t.trackOrderBtn}</span>
            </button>
          )}

          {/* Cart / Pre-Order Button */}
          <button
            id="btn-open-cart"
            type="button"
            onClick={onOpenCart}
            className="relative px-3 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white font-black text-xs flex items-center gap-1.5 sm:gap-2 transition shadow-md active:scale-95 cursor-pointer"
            title={t.cartBtn}
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">{t.cartBtn}</span>
            {cartCount > 0 ? (
              <span className="flex items-center gap-1">
                <span className="bg-white text-[#880e4f] px-1.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black">
                  {cartCount}
                </span>
                {isPricesVisible && (
                  <span className="hidden md:inline text-[11px] font-bold opacity-95 font-mono">
                    ({formatDZD(cartTotalDA)})
                  </span>
                )}
              </span>
            ) : (
              <span className="hidden sm:inline text-[11px] opacity-80 font-normal">(0)</span>
            )}
          </button>
        </div>
      </div>

      {/* DEDICATED SUB-HEADER BAR: SWITCH MODE CENTERED */}
      {onToggleInterface && (
        <div
          className={`bg-gradient-to-r from-[#fdf8fa] via-[#faf0f4] to-[#fbf7f9] border-t border-rose-100/90 flex items-center justify-center relative transition-all duration-300 overflow-hidden ${
            isScrolledDown ? 'max-h-0 py-0 opacity-0 border-transparent pointer-events-none' : 'max-h-16 py-2 opacity-100'
          }`}
        >
          {/* Centered Mode Switcher */}
          <div className="flex items-center bg-white border border-rose-200/80 rounded-xl p-1 text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => onToggleInterface('showroom')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                currentInterface === 'showroom'
                  ? 'bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-[#9f0e4e]'
              }`}
              title={t.showroomMode}
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-200 shrink-0" />
              <span>{t.showroomMode}</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleInterface('quick')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                currentInterface === 'quick'
                  ? 'bg-gradient-to-r from-[#880e4f] to-[#be185d] text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-[#9f0e4e]'
              }`}
              title={t.quickOrderMode}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span>{t.quickOrderMode}</span>
            </button>
          </div>

          {/* Unobtrusive Admin indicator if active (positioned on right side) */}
          {isAdminMode && (
            <div className="absolute right-3 sm:right-4 flex items-center gap-2 bg-rose-50 border border-rose-300/80 px-2.5 py-1 rounded-lg text-[11px] text-[#880e4f] font-bold">
              <span className="hidden sm:inline">Admin Actif</span>
              {onToggleAdminMode && (
                <button
                  type="button"
                  onClick={onToggleAdminMode}
                  className="text-rose-600 hover:text-rose-900 flex items-center gap-1 cursor-pointer"
                  title="Masquer mode admin"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
};
