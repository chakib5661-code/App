import React from 'react';
import { Sparkles, LayoutGrid, Check, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { AppLanguage, translations } from '../translations';

interface InterfaceChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectInterface: (mode: 'showroom' | 'quick') => void;
  currentMode?: 'showroom' | 'quick';
  currentInterface?: 'showroom' | 'quick';
  lang?: AppLanguage;
}

export const InterfaceChoiceModal: React.FC<InterfaceChoiceModalProps> = ({
  isOpen,
  onClose,
  onSelectInterface,
  currentMode,
  currentInterface,
  lang = 'ar',
}) => {
  if (!isOpen) return null;

  const t = translations[lang];
  const activeMode = currentMode || currentInterface || 'showroom';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center max-w-lg mx-auto mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold mb-3">
            <Zap className="w-3.5 h-3.5" />
            <span>{t.chooseInterface || 'Mode d\'affichage'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t.chooseInterface || 'Choisissez votre expérience Tulip'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
            {lang === 'ar' ? 'يمكنكم التبديل بين الواجهة المرئية وقائمة الطلب السريع في أي وقت' : 'Basculez entre le showroom visuel et la saisie rapide en gros à tout moment.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Option 1: Showroom */}
          <button
            type="button"
            onClick={() => {
              onSelectInterface('showroom');
              onClose();
            }}
            className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between group cursor-pointer ${
              activeMode === 'showroom'
                ? 'border-rose-600 bg-rose-50/40 shadow-md ring-2 ring-rose-500/20'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {activeMode === 'showroom' && (
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
            )}
            <div>
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 group-hover:text-rose-600 transition">
                {t.showroomMode}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {t.showroomModeDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-rose-600">
              <span>{lang === 'ar' ? 'اختيار هذا النمط' : 'Sélectionner ce mode'}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </button>

          {/* Option 2: Quick Order */}
          <button
            type="button"
            onClick={() => {
              onSelectInterface('quick');
              onClose();
            }}
            className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between group cursor-pointer ${
              activeMode === 'quick'
                ? 'border-amber-500 bg-amber-50/40 shadow-md ring-2 ring-amber-500/20'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {activeMode === 'quick' && (
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <Check className="w-4 h-4" />
              </div>
            )}
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center mb-3">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 group-hover:text-amber-600 transition">
                {t.quickOrderMode}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {t.quickOrderModeDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-amber-600">
              <span>{lang === 'ar' ? 'اختيار هذا النمط' : 'Sélectionner ce mode'}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Même panier et mêmes données conservés</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 font-bold px-2 py-1 cursor-pointer"
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
};
