import React, { useEffect, useRef, useState } from 'react';
import { Menu as MenuIcon, Heart, Truck, FileText, Download, Loader2, LogOut, Bell, BellOff, ChevronRight } from 'lucide-react';
import type { AppLanguage } from '../translations';
import type { CustomerUser, LoyaltyTier, PreOrder } from '../types';
import type { PushStatus } from './AccountMenu';
import { formatDZD } from '../utils/formatDZD';

interface DesktopMenuProps {
  customer: CustomerUser;
  lang: AppLanguage;
  onSelectLanguage?: (lang: AppLanguage) => void;
  isPricesVisible?: boolean;
  loyaltyTier?: LoyaltyTier | null;
  nextTier?: LoyaltyTier | null;
  spendDA?: number;
  windowDays?: number;
  favoritesCount: number;
  onOpenFavorites: () => void;
  onOpenOrderTracking?: () => void;
  /** Most recent first; the panel shows the first three. */
  invoices: PreOrder[];
  onDownloadInvoice: (order: PreOrder) => Promise<void> | void;
  onOpenAllInvoices: () => void;
  onLogout?: () => void;
  pushStatus?: PushStatus;
  onEnablePush?: () => void;
}

/** Desktop header menu: account, favorites, orders, latest invoices, language. */
export const DesktopMenu: React.FC<DesktopMenuProps> = ({
  customer,
  lang,
  onSelectLanguage,
  isPricesVisible = false,
  loyaltyTier,
  nextTier,
  spendDA = 0,
  windowDays = 90,
  favoritesCount,
  onOpenFavorites,
  onOpenOrderTracking,
  invoices,
  onDownloadInvoice,
  onOpenAllInvoices,
  onLogout,
  pushStatus = 'unsupported',
  onEnablePush,
}) => {
  const L = (fr: string, en: string, ar: string) => (lang === 'ar' ? ar : lang === 'en' ? en : fr);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = customer.fullName || customer.username;
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const progress = nextTier && nextTier.minSpendDA > 0 ? Math.min(100, Math.round((spendDA / nextTier.minSpendDA) * 100)) : 100;
  const recent = invoices.slice(0, 3);

  const run = (fn?: () => void) => () => {
    setOpen(false);
    fn?.();
  };
  const download = async (o: PreOrder) => {
    setBusyId(o.id);
    try {
      await onDownloadInvoice(o);
    } finally {
      setBusyId(null);
    }
  };
  const dateLabel = (o: PreOrder) => {
    const d = new Date(o.createdAt || o.date);
    return isNaN(d.getTime())
      ? o.date
      : d.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : lang === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const row =
    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-800 text-left hover:bg-rose-50 transition cursor-pointer';
  const ico = 'w-8 h-8 rounded-lg bg-rose-50 text-[#9f0e4e] flex items-center justify-center shrink-0';

  return (
    <div className="relative max-sm:hidden" ref={ref}>
      <button
        type="button"
        id="btn-desktop-menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
          open ? 'bg-rose-50 border-[#9f0e4e] text-[#9f0e4e]' : 'bg-white border-rose-200 text-slate-700 hover:bg-rose-50'
        }`}
      >
        <MenuIcon className="w-4 h-4" />
        {L('Menu', 'Menu', 'القائمة')}
        {favoritesCount > 0 && (
          <span className="px-1.5 rounded-full bg-[#9f0e4e] text-white text-[10px] font-black">{favoritesCount}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          className="absolute right-0 mt-2 w-[400px] max-w-[calc(100vw-24px)] bg-white rounded-2xl border border-rose-200 shadow-2xl z-50 overflow-hidden"
        >
          <div className="px-4 py-4 bg-gradient-to-r from-[#70083b] to-[#9f0e4e] text-white">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black shrink-0">{initials}</span>
              <div className="min-w-0">
                <div className="font-black truncate">{name}</div>
                <div className="text-[11px] text-rose-100 truncate">
                  {customer.companyName || (isPricesVisible ? L('Compte approuvé', 'Approved account', 'حساب مفعّل') : '')}
                </div>
              </div>
              {loyaltyTier && (
                <span className="ms-auto px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-amber-950 text-[10px] font-black shrink-0">
                  ★ {loyaltyTier.name}
                </span>
              )}
            </div>
            {nextTier && (
              <div className="mt-3 text-[11px]">
                {formatDZD(Math.max(0, nextTier.minSpendDA - spendDA))} {L('pour atteindre', 'to reach', 'للوصول إلى')} {nextTier.name} ({windowDays} {L('jours', 'days', 'يوم')})
                <div className="h-1.5 rounded-full bg-white/25 mt-1.5 overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="p-2">
            <button type="button" role="menuitem" className={row} onClick={run(onOpenFavorites)}>
              <span className={ico}><Heart className="w-4 h-4" /></span>
              {L('Mes favoris', 'My favorites', 'مفضلتي')}
              {favoritesCount > 0 && <span className="ms-auto text-xs font-black text-[#9f0e4e]">{favoritesCount}</span>}
            </button>
            {onOpenOrderTracking && (
              <button type="button" role="menuitem" className={row} onClick={run(onOpenOrderTracking)}>
                <span className={ico}><Truck className="w-4 h-4" /></span>
                {L('Suivre mes commandes', 'Track my orders', 'تتبع طلباتي')}
              </button>
            )}
            {onEnablePush && (pushStatus === 'off' || pushStatus === 'on') && (
              <button type="button" role="menuitem" className={row} disabled={pushStatus === 'on'} onClick={() => onEnablePush()}>
                <span className={ico}>{pushStatus === 'on' ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}</span>
                {pushStatus === 'on' ? L('Notifications activées', 'Notifications on', 'الإشعارات مفعّلة') : L('Activer les notifications', 'Enable notifications', 'تفعيل الإشعارات')}
              </button>
            )}
          </div>

          <div className="px-4 pt-2 pb-1 flex items-center justify-between text-[10.5px] font-black uppercase tracking-wider text-slate-500">
            <span>{L('Mes factures', 'My invoices', 'فواتيري')}</span>
            {invoices.length > 0 && (
              <button type="button" onClick={run(onOpenAllInvoices)} className="inline-flex items-center gap-0.5 normal-case tracking-normal text-[#9f0e4e] font-bold cursor-pointer">
                {L('Voir tout', 'See all', 'عرض الكل')} <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="px-2 pb-2">
            {recent.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-500 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {L('Aucune facture pour le moment.', 'No invoices yet.', 'لا توجد فواتير بعد.')}
              </p>
            ) : (
              recent.map((o) => (
                <div key={o.id} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-50">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 truncate">#{o.orderNumber}</div>
                    <div className="text-[11.5px] text-slate-500 tabular-nums truncate">
                      {dateLabel(o)} · {o.items.length} {L('articles', 'items', 'منتج')}
                      {isPricesVisible ? ` · ${formatDZD(o.totalDA)}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => download(o)}
                    disabled={busyId === o.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-[#9f0e4e] text-[11.5px] font-black hover:bg-white disabled:opacity-60 cursor-pointer"
                    aria-label={`${L('Télécharger la facture', 'Download invoice', 'تحميل الفاتورة')} #${o.orderNumber}`}
                  >
                    {busyId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    PDF
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-rose-100 px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {([['fr', 'FR'], ['en', 'EN'], ['ar', 'عربي']] as [AppLanguage, string][]).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onSelectLanguage?.(code)}
                  className={`px-2.5 py-1 rounded-lg border text-[11.5px] font-bold cursor-pointer ${
                    lang === code ? 'bg-[#9f0e4e] border-[#9f0e4e] text-white' : 'bg-white border-rose-200 text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {onLogout && (
              <button type="button" onClick={run(onLogout)} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#9f0e4e] cursor-pointer">
                <LogOut className="w-3.5 h-3.5" />
                {L('Se déconnecter', 'Log out', 'تسجيل الخروج')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
