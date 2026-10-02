/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Smartphone, Sparkles, X, ChevronRight, WifiOff, Zap } from 'lucide-react';
import { DeviceInfo, detectUserDevice } from '../utils/deviceDetector';
import { AppLanguage } from '../translations';

interface PwaInstallAdviceBannerProps {
  lang: AppLanguage;
  onOpenInstallGuide: () => void;
  deviceInfo: DeviceInfo;
}

const DISMISS_STORAGE_KEY = 'tulip_pwa_advice_dismissed_v2';
const DISMISS_DAYS = 7;

export const PwaInstallAdviceBanner: React.FC<PwaInstallAdviceBannerProps> = ({
  lang,
  onOpenInstallGuide,
  deviceInfo,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // If running in standalone PWA mode, don't show install advice
    if (deviceInfo.isStandalone) {
      return;
    }

    // Check if dismissed recently
    try {
      const dismissedTimestamp = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissedTimestamp) {
        const diff = Date.now() - parseInt(dismissedTimestamp, 10);
        if (diff < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
          return;
        }
      }
    } catch {
      // Ignore localStorage error
    }

    // Delay display slightly (3.5s) to let the storefront load smoothly without interrupting
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, [deviceInfo.isStandalone]);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
    } catch {}
  };

  const handleOpenGuide = () => {
    setIsVisible(false);
    onOpenInstallGuide();
  };

  if (!isVisible) return null;

  const isArabic = lang === 'ar';
  const phoneName = deviceInfo.phoneBrand !== 'Inconnu' && deviceInfo.phoneBrand !== 'Générique'
    ? `${deviceInfo.phoneBrand} ${deviceInfo.phoneModel !== 'Appareil' && deviceInfo.phoneModel !== 'Mobile' ? deviceInfo.phoneModel : ''}`.trim()
    : 'votre téléphone';

  return (
    <div
      dir="ltr"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
      role="region"
      aria-label="Conseil d'installation PWA"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/90 text-white p-4 shadow-2xl shadow-slate-950/30 border border-amber-500/30 backdrop-blur-md">
        {/* Ambient Glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-3.5 relative z-10">
          {/* Icon Badge */}
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <Smartphone className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            {/* Header pill */}
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                {isArabic ? 'نصيحة تولييب' : 'Conseil Tulip Fragrance'}
              </span>
            </div>

            {/* Advice text */}
            <h4 className="text-xs sm:text-sm font-bold text-white leading-snug">
              {isArabic ? (
                <>ثبّت التطبيق على {phoneName} للطلب حتى بدون إنترنت !</>
              ) : (
                <>Installez l'application sur {phoneName} pour commander même hors-ligne !</>
              )}
            </h4>

            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed line-clamp-2">
              {isArabic
                ? 'سجل طلبياتك بالجملة بدون شبكة وسيتم إرسالها تلقائياً فور عودة الاتصال، مع تصفح فوري للكتالوج.'
                : 'Passez vos précommandes sans réseau (envoi auto dès le retour d\'Internet) et accédez à vos tarifs en 1 clic.'}
            </p>

            {/* Micro Badges */}
            <div className="flex items-center gap-2 mt-2 text-[10px] text-amber-300/90 font-medium">
              <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md">
                <WifiOff className="w-2.5 h-2.5" /> {isArabic ? 'وضع عدم الاتصال' : 'Hors-ligne actif'}
              </span>
              <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md">
                <Zap className="w-2.5 h-2.5" /> {isArabic ? 'تثبيت سريع' : '100% Gratuit'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                id="pwa-advice-show-guide-btn"
                onClick={handleOpenGuide}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs transition flex items-center gap-1 cursor-pointer shadow-sm shadow-amber-500/30"
              >
                <span>{isArabic ? 'كيفية التثبيت' : 'Comment installer ?'}</span>
                <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>

              <button
                type="button"
                id="pwa-advice-later-btn"
                onClick={handleDismiss}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                {isArabic ? 'لاحقاً' : 'Plus tard'}
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            id="pwa-advice-close-btn"
            onClick={handleDismiss}
            aria-label="Fermer le conseil"
            className="absolute top-0 right-0 p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
