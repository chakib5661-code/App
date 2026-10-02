import React from 'react';
import { Phone } from 'lucide-react';

interface AlgerianPhoneInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
  autoFocus?: boolean;
}

export const AlgerianPhoneInput: React.FC<AlgerianPhoneInputProps> = ({
  id,
  value,
  onChange,
  placeholder = '05 XX XX XX XX',
  error,
  disabled = false,
  required = false,
  theme = 'light',
  className = '',
  autoFocus = false,
}) => {
  const isDark = theme === 'dark';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // Allow digits, spaces, dashes
    const cleaned = raw.replace(/[^\d\s-+]/g, '');
    onChange(cleaned);
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`flex items-center rounded-xl border transition overflow-hidden shadow-2xs ${
          error
            ? isDark
              ? 'border-rose-500 bg-rose-950/20 ring-1 ring-rose-500/50'
              : 'border-rose-400 bg-rose-50 ring-1 ring-rose-300'
            : isDark
            ? 'border-slate-700 bg-slate-900 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500/50'
            : 'border-slate-300 bg-slate-50 focus-within:border-amber-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-amber-500/40'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {/* Fixed Algeria +213 Prefix Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-2 shrink-0 border-r select-none ${
            isDark
              ? 'bg-slate-800/80 border-slate-700 text-slate-200'
              : 'bg-slate-150 border-slate-300 text-slate-800'
          }`}
          title="Code indicatif Algérie (+213) par défaut"
        >
          <span className="text-base leading-none" role="img" aria-label="Drapeau Algérie">
            🇩🇿
          </span>
          <span className="font-mono text-xs font-bold tracking-tight">
            +213
          </span>
        </div>

        {/* Phone Input Field */}
        <div className="relative flex-1 flex items-center">
          <input
            id={id}
            type="tel"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            autoFocus={autoFocus}
            className={`w-full py-2 px-3 text-xs sm:text-sm font-mono focus:outline-hidden bg-transparent ${
              isDark
                ? 'text-white placeholder:text-slate-500'
                : 'text-slate-900 placeholder:text-slate-400'
            }`}
          />
          <Phone
            className={`w-3.5 h-3.5 mr-3 shrink-0 pointer-events-none ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}
          />
        </div>
      </div>

      {error && (
        <span
          className={`text-[11px] mt-1 block font-medium ${
            isDark ? 'text-rose-400' : 'text-rose-600'
          }`}
        >
          {error}
        </span>
      )}
    </div>
  );
};
