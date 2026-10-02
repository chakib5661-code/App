import React from 'react';
import { Sparkles } from 'lucide-react';
import { AppLanguage } from '../translations';

interface ProductSkeletonGridProps {
  lang?: AppLanguage;
  count?: number;
}

export const ProductSkeletonGrid: React.FC<ProductSkeletonGridProps> = ({
  lang = 'ar',
}) => {
  const isRtl = false; // Layout stays LTR for accessibility and right-handed reachability

  const textMap = {
    ar: {
      title: 'توليب • جاري صياغة وتحضير العطور',
      subtitle: 'يتم الآن تجميع المواد الأولية، الزيوت العطرية من غراس، ومخزون الفتحات والملحقات مباشرة...',
      step1: 'الاتصال بالخادم المركزي الآمن...',
      step2: 'تحضير قائمة الأسعار بالدينار الجزائري...',
      step3: 'تحديث حالة مخزون الورشة الفعلي...',
    },
    fr: {
      title: 'Tulip • Formulation de vos Essences',
      subtitle: 'Chargement en cours des matières premières de Grasse, flaconnage d’Italie et stocks réels...',
      step1: 'Connexion sécurisée à la base de données...',
      step2: 'Chargement des tarifs officiels en Dinars (DA)...',
      step3: 'Vérification en temps réel des stocks de l’atelier...',
    },
    en: {
      title: 'Tulip • Formulating Your Catalog',
      subtitle: 'Retrieving fresh raw perfume concentrates from Grasse, luxury bottles, and live quantities...',
      step1: 'Establishing secured connection...',
      step2: 'Formatting official wholesale price in Dinars (DA)...',
      step3: 'Validating workshop inventory levels...',
    },
  }[lang];

  return (
    <div className="w-full py-8 px-4 flex flex-col items-center justify-center min-h-[550px] relative overflow-hidden bg-slate-950 rounded-3xl border border-[#70083b]/30 shadow-2xl">
      {/* Dynamic Keyframe & Style Injector */}
      <style>{`
        @keyframes liquidWave {
          0% { transform: rotate(0deg); border-radius: 38% 42% 40% 45%; }
          50% { transform: rotate(180deg); border-radius: 45% 40% 43% 38%; }
          100% { transform: rotate(360deg); border-radius: 38% 42% 40% 45%; }
        }
        @keyframes dripDrop {
          0% { transform: translateY(-40px) scale(0.6); opacity: 0; }
          30% { opacity: 1; }
          80% { transform: translateY(45px) scale(1); opacity: 0.8; }
          100% { transform: translateY(55px) scale(0.4); opacity: 0; }
        }
        @keyframes floatBubble {
          0% { transform: translateY(20px) translateX(0px); opacity: 0; }
          40% { opacity: 0.6; }
          90% { opacity: 0.2; }
          100% { transform: translateY(-130px) translateX(var(--bubble-drift, 15px)); opacity: 0; }
        }
        @keyframes subtlePulse {
          0%, 100% { opacity: 0.4; transform: scale(0.98); }
          50% { opacity: 0.8; transform: scale(1.02); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 25px 2px rgba(112, 8, 59, 0.2), 0 0 40px 1px rgba(245, 158, 11, 0.1); }
          50% { box-shadow: 0 0 45px 8px rgba(112, 8, 59, 0.4), 0 0 60px 4px rgba(245, 158, 11, 0.25); }
        }
        .scent-bubble {
          animation: floatBubble 4s infinite ease-out;
        }
      `}</style>

      {/* Decorative Background Lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-[#70083b]/20 to-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-48 h-48 bg-[#9f0e4e]/5 rounded-full blur-2xl pointer-events-none animate-pulse" />
      <div className="absolute top-10 right-10 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none animate-pulse" />

      {/* Fancy Animated Perfume Bottle Loader Showcase */}
      <div className="relative mb-12 flex flex-col items-center">
        {/* Floating Scent Bubbles */}
        <div className="absolute -top-16 w-36 h-36 pointer-events-none z-10 overflow-hidden">
          <div className="absolute bottom-0 left-[25%] w-2 h-2 rounded-full bg-amber-400/50 scent-bubble" style={{ '--bubble-drift': '-20px', animationDelay: '0.2s' } as React.CSSProperties} />
          <div className="absolute bottom-2 left-[50%] w-3 h-3 rounded-full bg-[#9f0e4e]/40 scent-bubble" style={{ '--bubble-drift': '15px', animationDelay: '1.1s' } as React.CSSProperties} />
          <div className="absolute bottom-1 left-[70%] w-1.5 h-1.5 rounded-full bg-amber-300/60 scent-bubble" style={{ '--bubble-drift': '-10px', animationDelay: '2.5s' } as React.CSSProperties} />
          <div className="absolute bottom-3 left-[40%] w-2.5 h-2.5 rounded-full bg-white/30 scent-bubble" style={{ '--bubble-drift': '25px', animationDelay: '3.3s' } as React.CSSProperties} />
        </div>

        {/* Droplet Dispenser / Falling Essential Oil Drops */}
        <div className="absolute -top-10 w-2 h-2 rounded-full bg-amber-400" />
        <div 
          className="absolute -top-10 w-2.5 h-2.5 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 shadow-md"
          style={{ animation: 'dripDrop 2.2s infinite cubic-bezier(0.4, 0, 0.2, 1)' }}
        />

        {/* Majestic 3D Glass Flask Outline */}
        <div 
          className="w-28 h-36 rounded-b-[40px] rounded-t-3xl border-3 border-rose-100/30 bg-slate-900/40 relative flex items-end justify-center overflow-hidden"
          style={{ 
            animation: 'pulseGlow 4s infinite ease-in-out',
            perspective: '1000px'
          }}
        >
          {/* Flask Cap/Atomizer details */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-4 bg-gradient-to-b from-slate-800 to-slate-900 border-b border-rose-100/20" />
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-1.5 bg-amber-500 rounded-t-sm" />

          {/* Scent Pipette/Tube inside the bottle */}
          <div className="absolute top-4 bottom-2 w-0.5 bg-rose-100/20 left-1/2 -translate-x-1/2" />

          {/* Wave Liquid fill animation */}
          <div className="w-full h-1/2 relative bg-[#70083b]/30 overflow-hidden rounded-b-[36px]">
            {/* Liquid Level wave effect 1 */}
            <div 
              className="absolute -top-14 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-tr from-[#70083b] to-[#9f0e4e] opacity-80"
              style={{
                animation: 'liquidWave 8s infinite linear'
              }}
            />
            {/* Liquid Level wave effect 2 */}
            <div 
              className="absolute -top-[52px] left-1/2 -translate-x-1/2 w-52 h-52 bg-gradient-to-br from-amber-500 to-[#70083b] opacity-40"
              style={{
                animation: 'liquidWave 5s infinite linear'
              }}
            />
            {/* Sparkles on liquid surface */}
            <div className="absolute bottom-4 left-4 w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <div className="absolute bottom-8 right-6 w-1 h-1 rounded-full bg-amber-300 animate-pulse" />
          </div>
        </div>

        {/* Glowing Aura Ring below the bottle */}
        <div 
          className="w-20 h-2 rounded-full bg-[#70083b]/40 mt-3 blur-xs"
          style={{ animation: 'subtlePulse 2s infinite ease-in-out' }}
        />
      </div>

      {/* Fancy Dynamic Titles */}
      <div className="max-w-lg text-center space-y-4 relative z-10 px-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
          <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-rose-200 tracking-tight">
            {textMap.title}
          </h2>
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse shrink-0" style={{ animationDelay: '1s' }} />
        </div>
        
        <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed max-w-md mx-auto">
          {textMap.subtitle}
        </p>

        {/* Fancy loading checklist steps */}
        <div className="pt-4 border-t border-[#70083b]/20 space-y-2 max-w-xs mx-auto text-left">
          <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-400">
            <span className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </span>
            <span className="truncate">{textMap.step1}</span>
          </div>
          <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-400">
            <span className="w-4 h-4 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            </span>
            <span className="truncate">{textMap.step2}</span>
          </div>
          <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-400">
            <span className="w-4 h-4 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            </span>
            <span className="truncate">{textMap.step3}</span>
          </div>
        </div>

        {/* Miniature Progress Bar */}
        <div className="w-44 h-1 bg-slate-900 rounded-full mx-auto overflow-hidden mt-6 relative border border-[#70083b]/10">
          <div className="h-full bg-gradient-to-r from-[#70083b] via-amber-500 to-[#9f0e4e] w-4/5 rounded-full animate-pulse" />
        </div>
        <div className="text-[9px] font-bold tracking-widest text-[#70083b] uppercase animate-pulse">
          L'Atelier Tulip Fragrance
        </div>
      </div>
    </div>
  );
};
