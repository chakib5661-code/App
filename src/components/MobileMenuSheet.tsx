import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ClipboardList, Heart, LogIn, LogOut, UserRound, Star } from 'lucide-react';
import type { AppLanguage } from '../translations';

interface MobileMenuSheetProps {
  open: boolean;
  onClose: () => void;
  lang: AppLanguage;
  onSelectLanguage: (lang: AppLanguage) => void;
  customerName?: string | null;
  loyaltyName?: string | null;
  favoritesCount: number;
  onOpenOrders: () => void;
  onOpenFavorites: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

/** Phone menu: account, order tracking, favorites and language in one place. */
export const MobileMenuSheet: React.FC<MobileMenuSheetProps> = ({
  open,
  onClose,
  lang,
  onSelectLanguage,
  customerName,
  loyaltyName,
  favoritesCount,
  onOpenOrders,
  onOpenFavorites,
  onLogin,
  onLogout,
}) => {
  const L = (fr: string, en: string, ar: string) => (lang === 'ar' ? ar : lang === 'en' ? en : fr);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const row =
    'w-full flex items-center justify-between gap-3 px-4 py-3.5 border-b border-slate-100 last:border-b-0 text-sm font-bold text-slate-900 text-left cursor-pointer hover:bg-rose-50/60';

  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true" dir="ltr">
      <button type="button" aria-label={L('Fermer', 'Close', 'إغلاق')} className="absolute inset-0 bg-slate-950/50 cursor-default" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto pb-[max(16px,env(safe-area-inset-bottom,0px))]">
        <div className="pt-2.5 pb-1"><div className="mx-auto h-1 w-10 rounded-full bg-slate-200" /></div>
        <div className="flex items-center justify-between px-4 pt-1 pb-3">
          <h2 className="text-base font-black text-slate-900">{L('Menu', 'Menu', 'القائمة')}</h2>
          <button type="button" onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer" aria-label={L('Fermer', 'Close', 'إغلاق')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mx-4 mb-3 rounded-2xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] text-white px-4 py-3 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0"><UserRound className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="font-black truncate">{customerName || L('Visiteur', 'Guest', 'زائر')}</div>
            <div className="text-xs text-rose-100 truncate flex items-center gap-1">
              {customerName ? (
                loyaltyName ? (<><Star className="w-3 h-3" />{loyaltyName}</>) : L('Compte professionnel', 'Professional account', 'حساب مهني')
              ) : (
                L('Connectez-vous pour voir les prix', 'Log in to see prices', 'سجّل الدخول لرؤية الأسعار')
              )}
            </div>
          </div>
        </div>

        <div className="mx-4 rounded-2xl border border-slate-200 overflow-hidden">
          <button type="button" className={row} onClick={run(onOpenOrders)}>
            <span className="flex items-center gap-3"><ClipboardList className="w-5 h-5 text-[#9f0e4e]" />{L('Suivre ma commande', 'Track my order', 'تتبع طلبي')}</span>
          </button>
          <button type="button" className={row} onClick={run(onOpenFavorites)}>
            <span className="flex items-center gap-3"><Heart className="w-5 h-5 text-[#9f0e4e]" />{L('Mes favoris', 'My favorites', 'مفضلتي')}</span>
            {favoritesCount > 0 && <span className="text-xs font-black text-[#9f0e4e]">{favoritesCount}</span>}
          </button>
          {customerName ? (
            <button type="button" className={row} onClick={run(onLogout)}>
              <span className="flex items-center gap-3"><LogOut className="w-5 h-5 text-slate-500" />{L('Se déconnecter', 'Log out', 'تسجيل الخروج')}</span>
            </button>
          ) : (
            <button type="button" className={row} onClick={run(onLogin)}>
              <span className="flex items-center gap-3"><LogIn className="w-5 h-5 text-[#9f0e4e]" />{L('Connexion / Demander l’accès', 'Log in / Request access', 'تسجيل الدخول / طلب الوصول')}</span>
            </button>
          )}
        </div>

        <div className="mx-4 mt-3">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">{L('Langue', 'Language', 'اللغة')}</div>
          <div className="grid grid-cols-3 gap-2">
            {([['fr', 'Français'], ['en', 'English'], ['ar', 'العربية']] as [AppLanguage, string][]).map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => onSelectLanguage(code)}
                className={`py-2.5 rounded-xl border text-sm font-bold cursor-pointer ${
                  lang === code ? 'bg-[#9f0e4e] border-[#9f0e4e] text-white' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
