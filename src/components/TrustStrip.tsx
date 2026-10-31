import React from 'react';
import { Truck, ShieldCheck } from 'lucide-react';

interface TrustStripProps {
  lang?: string;
}

/** Short reassurance line shown next to the order button. Only states what the store already advertises. */
export const TrustStrip: React.FC<TrustStripProps> = ({ lang = 'fr' }) => {
  const L = (fr: string, en: string, ar: string) => (lang === 'ar' ? ar : lang === 'en' ? en : fr);
  const items = [
    { icon: Truck, text: L('Livraison 58 wilayas', 'Delivery to 58 wilayas', 'التوصيل إلى 58 ولاية') },
    { icon: ShieldCheck, text: L('Vente en gros et demi-gros', 'Wholesale and half-wholesale', 'بيع بالجملة ونصف الجملة') },
  ];
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-600" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-[#9f0e4e]" aria-hidden="true" />
          {text}
        </li>
      ))}
    </ul>
  );
};
