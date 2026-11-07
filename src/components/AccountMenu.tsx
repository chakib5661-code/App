import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, ChevronDown, LogOut, Star, Truck, User } from 'lucide-react';
import { CustomerUser, LoyaltyTier } from '../types';
import { formatDZD } from '../utils/formatDZD';

export type PushStatus = 'unsupported' | 'unavailable' | 'off' | 'on' | 'denied';

interface AccountMenuProps {
  customer: CustomerUser;
  lang?: string;
  loyaltyTier?: LoyaltyTier | null;
  nextTier?: LoyaltyTier | null;
  spendDA?: number;
  windowDays?: number;
  spendStats?: { totalSpendDA: number; ordersCount: number; since: string | null } | null;
  onOpenOrderTracking?: () => void;
  onLogout?: () => void;
  pushStatus?: PushStatus;
  onEnablePush?: () => void;
  marketingPush?: boolean;
  onToggleMarketing?: (value: boolean) => void;
  /** Render the menu body in place (no button, always open), e.g. inside the phone Menu sheet */
  inline?: boolean;
  /** Called after an action in inline mode so the host sheet can close */
  onAfterAction?: () => void;
}

/** Account button (icon + name + loyalty badge). Track order, notifications and logout live in its menu. */
export const AccountMenu: React.FC<AccountMenuProps> = ({
  customer,
  lang = 'fr',
  loyaltyTier,
  nextTier,
  spendDA = 0,
  windowDays = 90,
  spendStats = null,
  onOpenOrderTracking,
  onLogout,
  pushStatus = 'unsupported',
  onEnablePush,
  marketingPush = true,
  onToggleMarketing,
  inline = false,
  onAfterAction,
}) => {
  const [openState, setOpen] = useState(false);
  const open = inline || openState;
  const ref = useRef<HTMLDivElement>(null);
  const tr = (ar: string, fr: string) => (lang === 'ar' ? ar : fr);

  useEffect(() => {
    if (!open || inline) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const progress = nextTier && nextTier.minSpendDA > 0 ? Math.min(100, Math.round((spendDA / nextTier.minSpendDA) * 100)) : 100;
  const item =
    'w-full flex items-center gap-2.5 px-3 py-3.5 sm:py-2.5 text-sm sm:text-xs font-bold text-left text-slate-700 hover:bg-rose-50 hover:text-[#880e4f] transition cursor-pointer';

  return (
    <div className="relative" ref={ref}>
      {!inline && (
      <button
        type="button"
        id="btn-account-menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 sm:gap-2 bg-pink-50 hover:bg-pink-100/70 border border-pink-200/90 px-2.5 sm:px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-xl text-xs transition cursor-pointer"
        title={customer.fullName || customer.username}
      >
        <User className="w-3.5 h-3.5 text-[#9f0e4e] shrink-0" />
        <span className="text-[#70083b] font-bold max-w-[72px] sm:max-w-[140px] truncate">
          {customer.username}
        </span>
        {loyaltyTier && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-amber-950 text-[10px] font-black shadow-xs">
            <Star className="w-3 h-3 fill-amber-900 text-amber-900" />
            <span className="max-w-[56px] sm:max-w-none truncate">{loyaltyTier.name}</span>
          </span>
        )}
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      )}

      {open && (
        <div
          role="menu"
          className={
            inline
              ? 'bg-white rounded-2xl border border-rose-200 overflow-hidden'
              : 'absolute right-0 mt-2 w-72 max-w-[calc(100vw-24px)] bg-white rounded-2xl border border-rose-200 shadow-2xl z-50 overflow-hidden'
          }
        >
          <div className="px-4 py-3 bg-gradient-to-r from-[#500428] to-[#9f0e4e] text-white">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-black truncate">{customer.fullName || customer.username}</span>
              {loyaltyTier && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-amber-950 text-[10px] font-black shrink-0">
                  <Star className="w-3 h-3 fill-amber-900 text-amber-900" />
                  {loyaltyTier.name}
                </span>
              )}
            </div>
            {customer.companyName && <div className="text-[11px] text-rose-100 truncate">{customer.companyName}</div>}
          </div>

          {spendStats && (
            <div className="px-4 py-3 border-b border-rose-100 text-xs">
              <div className="font-black text-[#70083b] mb-1.5">{tr('مشترياتك في الموقع', 'Mes achats sur le site')}</div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-slate-500">{tr('المجموع', 'Total dépensé')}</span>
                <bdi dir="ltr" className="text-base font-black font-mono text-slate-900">{formatDZD(spendStats.totalSpendDA)}</bdi>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1 text-slate-600">
                <span>{tr('عدد الطلبات', 'Commandes')} : <b>{spendStats.ordersCount}</b></span>
                <span>{windowDays} {tr('يوم', 'j')} : <bdi dir="ltr" className="font-bold">{formatDZD(spendDA)}</bdi></span>
              </div>
            </div>
          )}

          {(loyaltyTier || nextTier) && (
            <div className="px-4 py-3 border-b border-rose-100 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-[#70083b]">{tr('مستوى الولاء', 'Statut fidélité')}</span>
                {loyaltyTier ? (
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-amber-950 text-[10px] font-black">
                    ★ {loyaltyTier.name}
                  </span>
                ) : (
                  <span className="text-slate-500">{tr('لا يوجد بعد', 'Pas encore de niveau')}</span>
                )}
              </div>
              {loyaltyTier?.perk && <div className="text-slate-600">{loyaltyTier.perk}</div>}
              {nextTier && (
                <>
                  <div className="h-1.5 rounded-full bg-rose-100 overflow-hidden">
                    <div className="h-full bg-[#9f0e4e]" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {formatDZD(Math.max(0, nextTier.minSpendDA - spendDA))} {tr('للوصول إلى', 'pour atteindre')} {nextTier.name} ({windowDays} {tr('يوم', 'jours')})
                  </div>
                </>
              )}
            </div>
          )}

          <div className="py-1">
            {onOpenOrderTracking && (
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  setOpen(false);
                  onAfterAction?.();
                  onOpenOrderTracking();
                }}
              >
                <Truck className="w-4 h-4 text-[#9f0e4e]" />
                {tr('تتبع طلبيتك', 'Suivre mes commandes')}
              </button>
            )}
            {onEnablePush && (pushStatus === 'off' || pushStatus === 'on' || pushStatus === 'denied') && (
              <button
                type="button"
                role="menuitem"
                className={item}
                disabled={pushStatus !== 'off'}
                onClick={() => onEnablePush()}
              >
                {pushStatus === 'on' ? (
                  <Bell className="w-4 h-4 text-emerald-600" />
                ) : (
                  <BellOff className="w-4 h-4 text-[#9f0e4e]" />
                )}
                {pushStatus === 'on'
                  ? tr('الإشعارات مفعّلة', 'Notifications activées')
                  : pushStatus === 'denied'
                  ? tr('الإشعارات محظورة في المتصفح', 'Notifications bloquées par le navigateur')
                  : tr('تفعيل الإشعارات', 'Activer les notifications')}
              </button>
            )}
            {onToggleMarketing && pushStatus === 'on' && (
              <label className={`${item} justify-between`}>
                <span className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-[#9f0e4e]" />
                  {tr('عروض وتذكيرات', 'Offres et rappels')}
                </span>
                <input
                  type="checkbox"
                  className="accent-[#9f0e4e] w-4 h-4"
                  checked={marketingPush}
                  onChange={(e) => onToggleMarketing(e.target.checked)}
                />
              </label>
            )}
            {onLogout && (
              <button
                type="button"
                role="menuitem"
                className={`${item} text-rose-700 border-t border-rose-100`}
                onClick={() => {
                  setOpen(false);
                  onAfterAction?.();
                  onLogout();
                }}
              >
                <LogOut className="w-4 h-4" />
                {tr('تسجيل الخروج', 'Se déconnecter')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
