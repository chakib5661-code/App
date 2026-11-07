import React from 'react';
import { AlertCircle, Check, Gift, Percent, Sparkles, Trophy, Truck } from 'lucide-react';
import { ComputedCart } from '../utils/offers';
import { OffersConfig, RewardTier } from '../types';
import { formatDZD } from '../utils/formatDZD';

interface RewardLadderProps {
  calc: ComputedCart;
  offers: OffersConfig;
  lang?: string;
  /** 'cart' pinned at the top of the cart drawer, 'store' banner in the catalogue */
  variant?: 'cart' | 'store';
}

const ICONS: Record<RewardTier['type'], React.ElementType> = {
  percent: Percent,
  free_delivery: Truck,
  gift: Gift,
};

const STYLES = `
@keyframes rl-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
@keyframes rl-ring { 0% { box-shadow: 0 0 0 0 rgba(159,14,78,.45); } 100% { box-shadow: 0 0 0 10px rgba(159,14,78,0); } }
@keyframes rl-pop { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
@keyframes rl-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
.rl-shimmer { animation: rl-shimmer 2.2s ease-in-out infinite; }
.rl-ring { animation: rl-ring 1.6s ease-out infinite; }
.rl-pop { animation: rl-pop .55s cubic-bezier(.2,.9,.3,1.3) both; }
.rl-float { animation: rl-float 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .rl-shimmer, .rl-ring, .rl-pop, .rl-float { animation: none; } }
`;

/** Every configured reward tier on one animated track: unlocked, next to unlock, and still locked. */
export const RewardLadder: React.FC<RewardLadderProps> = ({ calc, offers, lang = 'fr', variant = 'cart' }) => {
  const tr = (ar: string, fr: string) => (lang === 'ar' ? ar : fr);
  const tiers = offers.rewardLadder.enabled
    ? offers.rewardLadder.tiers.slice().sort((a, b) => a.thresholdDA - b.thresholdDA)
    : [];
  const hasCart = calc.subtotalDA > 0;
  const showMin = hasCart && !calc.minOrderMet;
  if (tiers.length === 0 && !showMin) return null;

  const net = Math.max(0, calc.subtotalDA - calc.bundleDiscountDA);
  const n = tiers.length;
  const center = (i: number) => (i + 0.5) / Math.max(1, n);

  // Steps sit at equal distances along one track; the fill moves from step to step
  const pos = (i: number) => (i + 0.5) / Math.max(1, n);
  let fill = 0;
  for (let i = 0; i < n; i++) {
    const prevThreshold = i === 0 ? 0 : tiers[i - 1].thresholdDA;
    const prevPos = i === 0 ? 0 : pos(i - 1);
    if (net >= tiers[i].thresholdDA) {
      fill = pos(i);
      continue;
    }
    const frac = Math.max(0, (net - prevThreshold) / (tiers[i].thresholdDA - prevThreshold));
    fill = prevPos + frac * (pos(i) - prevPos);
    break;
  }
  const fillPct = net >= (tiers[n - 1]?.thresholdDA ?? Infinity) ? 100 : Math.round(fill * 100);

  const nextIndex = tiers.findIndex((t) => net < t.thresholdDA);
  const allDone = n > 0 && nextIndex === -1;
  const store = variant === 'store';
  const showLabels = n <= 4;

  const headline = allDone ? (
    tr('🎉 جميع المزايا مفعّلة', '🎉 Tous les avantages sont débloqués')
  ) : hasCart ? (
    <>
      {tr('أضف', 'Ajoutez')} <bdi dir="ltr">{formatDZD(tiers[nextIndex].thresholdDA - net)}</bdi>{' '}
      {tr('للحصول على', 'pour débloquer')} : <bdi>{tiers[nextIndex].label}</bdi>
    </>
  ) : (
    tr('كلما زادت طلبيتك زادت مزاياك', 'Plus votre commande est grande, plus vous gagnez')
  );

  return (
    <div
      className={
        store
          ? 'max-w-7xl mx-auto my-3 sm:my-5 rounded-2xl sm:rounded-3xl border border-rose-200 bg-gradient-to-br from-white via-rose-50 to-amber-50 shadow-sm px-3 sm:px-5 py-3'
          : 'px-4 py-2.5 border-b border-rose-200 bg-gradient-to-b from-rose-50 to-white'
      }
      role="status"
    >
      <style>{STYLES}</style>

      {showMin && (
        <div className="flex items-start gap-1.5 text-amber-800 font-bold text-xs mb-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {tr('الحد الأدنى للطلب', 'Minimum de commande')} : {formatDZD(calc.minOrderDA)} — {tr('تبقى', 'il manque')}{' '}
            {formatDZD(calc.missingForMinDA)}
          </span>
        </div>
      )}

      {n > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Trophy className={`${allDone ? 'rl-float' : ''} w-4 h-4 text-amber-500 shrink-0`} />
            <div className="text-xs sm:text-sm font-black text-[#70083b] leading-snug min-w-0">{headline}</div>
          </div>

          {/* One track, one step per reward */}
          <div className="relative h-9">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-white border border-rose-200 overflow-hidden">
              <div
                className="relative h-full rounded-full bg-gradient-to-r from-[#9f0e4e] via-[#c2185b] to-amber-400 transition-all duration-700 ease-out overflow-hidden"
                style={{ width: `${fillPct}%` }}
              >
                {fillPct > 0 && <span className="rl-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" />}
              </div>
            </div>
            {tiers.map((t, i) => {
              const reached = net >= t.thresholdDA;
              const isNext = i === nextIndex;
              const Icon = ICONS[t.type] || Sparkles;
              return (
                <div
                  key={t.id}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                  style={{ left: `${pos(i) * 100}%` }}
                  title={`${t.label} — ${formatDZD(t.thresholdDA)}`}
                >
                  <div
                    className={`${isNext ? 'rl-ring' : ''} w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${
                      reached
                        ? 'bg-emerald-500 border-white text-white'
                        : isNext
                        ? 'bg-gradient-to-br from-[#9f0e4e] to-[#c2185b] border-white text-white'
                        : 'bg-slate-100 border-slate-300 text-slate-400'
                    }`}
                  >
                    {reached ? <Check key={`ok-${t.id}`} className="rl-pop w-4 h-4" strokeWidth={3} /> : <Icon className="w-4 h-4" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Captions under each step */}
          <div className={`relative mt-0.5 ${store ? 'h-[52px]' : 'h-[52px] max-sm:h-[18px]'}`}>
            {tiers.map((t, i) => {
              const reached = net >= t.thresholdDA;
              const isNext = i === nextIndex;
              return (
                <div
                  key={t.id}
                  className="absolute top-0 -translate-x-1/2 text-center leading-tight"
                  style={{ left: `${pos(i) * 100}%`, width: `${96 / n}%` }}
                >
                  {showLabels && (
                    <div className={`${store ? '' : 'max-sm:hidden'} text-[11px] font-black line-clamp-2 ${reached ? 'text-emerald-700' : isNext ? 'text-[#70083b]' : 'text-slate-500'}`}>
                      {t.label}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 font-semibold">{formatDZD(t.thresholdDA)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
