import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../utils/useTheme';

interface ThemeToggleProps {
  lang?: string;
  /** "icon": round header button. "row": full-width row for the phone menu. */
  variant?: 'icon' | 'row';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ lang = 'fr', variant = 'icon', className = '' }) => {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  const label =
    lang === 'ar' ? (dark ? 'الوضع الفاتح' : 'الوضع الداكن') : lang === 'en' ? (dark ? 'Light mode' : 'Dark mode') : dark ? 'Mode clair' : 'Mode sombre';
  const Icon = dark ? Sun : Moon;

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={dark}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-bold cursor-pointer ${className}`}
      >
        <span className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-[#9f0e4e]" />
          {label}
        </span>
        <span className={`relative w-11 h-6 rounded-full transition-colors ${dark ? 'bg-[#9f0e4e]' : 'bg-slate-300'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${dark ? 'left-[22px]' : 'left-0.5'}`} />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`w-9 h-9 rounded-full flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-[#9f0e4e] border border-rose-200 cursor-pointer transition ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
};
