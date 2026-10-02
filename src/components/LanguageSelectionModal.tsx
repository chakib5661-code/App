import React from 'react';
import { Globe, Check } from 'lucide-react';
import { AppLanguage } from '../translations';
import { TulipLogo } from './TulipLogo';

interface LanguageSelectionModalProps {
  isOpen: boolean;
  currentLang: AppLanguage;
  onSelectLanguage: (lang: AppLanguage) => void;
}

export const LanguageSelectionModal: React.FC<LanguageSelectionModalProps> = ({
  isOpen,
  currentLang,
  onSelectLanguage,
}) => {
  if (!isOpen) return null;

  const languages: {
    code: AppLanguage;
    label: string;
    sublabel: string;
    flag: string;
    dir: 'ltr' | 'rtl';
  }[] = [
    {
      code: 'ar',
      label: 'العربية',
      sublabel: 'الجزائر - الدليل والطلب السريع',
      flag: '🇩🇿',
      dir: 'rtl',
    },
    {
      code: 'fr',
      label: 'Français',
      sublabel: 'Algérie - Catalogue & Commandes Gros',
      flag: '🇫🇷',
      dir: 'ltr',
    },
    {
      code: 'en',
      label: 'English',
      sublabel: 'Wholesale Fragrance Raw Materials',
      flag: '🇬🇧',
      dir: 'ltr',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col">
        {/* Header with Branding */}
        <div className="p-6 bg-slate-900 text-white text-center border-b border-slate-800">
          <div className="flex justify-center mb-3">
            <TulipLogo variant="horizontal" size="md" />
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2 border border-amber-500/30">
            <Globe className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-black tracking-tight">
            Sélectionnez votre langue / اختر لغتكم
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Choisissez la langue d'affichage du catalogue et des bons de commande
          </p>
        </div>

        {/* Options List */}
        <div className="p-5 space-y-3 bg-slate-50">
          {languages.map((langItem) => {
            const isSelected = currentLang === langItem.code;
            return (
              <button
                key={langItem.code}
                id={`btn-select-lang-${langItem.code}`}
                type="button"
                onClick={() => onSelectLanguage(langItem.code)}
                dir={langItem.dir}
                className={`w-full p-4 rounded-2xl border transition flex items-center justify-between text-left cursor-pointer group ${
                  isSelected
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/30 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span className="text-2xl select-none">{langItem.flag}</span>
                  <div>
                    <span className="block text-sm font-black text-slate-900 group-hover:text-amber-700 transition">
                      {langItem.label}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {langItem.sublabel}
                    </span>
                  </div>
                </div>

                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'border border-slate-300 group-hover:border-amber-400'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>
            );
          })}

          <p className="text-[11px] text-center text-slate-400 pt-2">
            Votre choix sera mémorisé pour vos prochaines visites. Vous pourrez le modifier à tout moment en bas de page.
          </p>
        </div>
      </div>
    </div>
  );
};
