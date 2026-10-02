import React from 'react';

interface TulipLogoProps {
  variant?: 'full' | 'icon' | 'horizontal';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSubtitle?: boolean;
  theme?: 'light' | 'dark';
}

export const TulipLogo: React.FC<TulipLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  showSubtitle = true,
  theme = 'light',
}) => {
  const sizeMap = {
    sm: { icon: 'w-7 h-7', title: 'text-sm', sub: 'text-[9px]' },
    md: { icon: 'w-9 h-9 sm:w-10 sm:h-10', title: 'text-base sm:text-lg', sub: 'text-[10px]' },
    lg: { icon: 'w-14 h-14', title: 'text-xl sm:text-2xl', sub: 'text-xs' },
    xl: { icon: 'w-20 h-20', title: 'text-3xl', sub: 'text-sm' },
  };

  const { icon: iconSize, title: titleSize, sub: subSize } = sizeMap[size];

  // SVG Tulip Petals Icon matching the poster's vivid tulip magenta gradient
  const IconSvg = (
    <div className={`relative ${iconSize} shrink-0 flex items-center justify-center`}>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="tulipPetalGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e91e63" />
            <stop offset="45%" stopColor="#c2185b" />
            <stop offset="100%" stopColor="#70083b" />
          </linearGradient>
          <linearGradient id="tulipPetalGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e91e63" />
            <stop offset="45%" stopColor="#c2185b" />
            <stop offset="100%" stopColor="#70083b" />
          </linearGradient>
          <linearGradient id="tulipPetalGradCenter" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#f06292" />
            <stop offset="40%" stopColor="#d81b60" />
            <stop offset="100%" stopColor="#880e4f" />
          </linearGradient>
        </defs>

        {/* Central Bud / Petal */}
        <path
          d="M50 14 C56 25 61 33 61 41 C61 50 56 57 50 61 C44 57 39 50 39 41 C39 33 44 25 50 14 Z"
          fill="url(#tulipPetalGradCenter)"
        />

        {/* Left Petal */}
        <path
          d="M46 60 C34 57 23 44 26 31 C28 22 38 20 45 29 C49 34 51 46 46 60 Z"
          fill="url(#tulipPetalGrad1)"
        />

        {/* Right Petal */}
        <path
          d="M54 60 C66 57 77 44 74 31 C72 22 62 20 55 29 C51 34 49 46 54 60 Z"
          fill="url(#tulipPetalGrad2)"
        />

        {/* Inner Core Separation Contour */}
        <path
          d="M50 36 C53 42 54 50 50 56 C46 50 47 42 50 36 Z"
          fill="#4a0426"
          opacity="0.5"
        />
      </svg>
    </div>
  );

  const isDark = theme === 'dark';

  if (variant === 'icon') {
    return <div className={`inline-flex items-center ${className}`}>{IconSvg}</div>;
  }

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {IconSvg}
        <div className="mt-2">
          <span
            className={`font-serif tracking-widest font-black block ${
              isDark ? 'text-white' : 'text-slate-900'
            } ${titleSize}`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            TULIP
          </span>
          {showSubtitle && (
            <span
              className={`tracking-[0.3em] font-sans font-semibold block uppercase ${
                isDark ? 'text-rose-200/90' : 'text-[#880e4f]'
              } ${subSize}`}
            >
              Fragrance Company
            </span>
          )}
        </div>
      </div>
    );
  }

  // Horizontal default layout
  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 ${className}`}>
      {IconSvg}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-serif tracking-widest font-black leading-none ${
              isDark ? 'text-white' : 'text-slate-900'
            } ${titleSize}`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            TULIP
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-pink-100 text-[#880e4f] font-bold border border-pink-200/80">
            ORAN
          </span>
        </div>
        {showSubtitle && (
          <span
            className={`tracking-[0.22em] font-sans font-semibold uppercase mt-0.5 leading-none ${
              isDark ? 'text-rose-200/80' : 'text-[#70083b]'
            } ${subSize}`}
          >
            Fragrance Company
          </span>
        )}
      </div>
    </div>
  );
};
