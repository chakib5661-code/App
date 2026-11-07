import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import type { AppLanguage } from '../translations';

/** Floating "back to top" button, shown after scrolling down (phone and desktop). */
export const ScrollToTopButton: React.FC<{ lang: AppLanguage }> = ({ lang }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setShow(window.scrollY > 500);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;
  const label = lang === 'ar' ? 'العودة إلى الأعلى' : lang === 'en' ? 'Back to top' : 'Remonter en haut';
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={label}
      title={label}
      className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-6 sm:right-6 z-30 w-11 h-11 rounded-full bg-gradient-to-br from-[#70083b] to-[#9f0e4e] text-white shadow-lg shadow-rose-900/30 flex items-center justify-center hover:scale-105 active:scale-95 transition cursor-pointer"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
};
