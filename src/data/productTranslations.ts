import { AppLanguage } from '../translations';
import { Product } from '../types';

export interface LocalizedProductInfo {
  name: string;
  description: string;
  category?: string;
  origin?: string;
}

export const PRODUCT_TRANSLATIONS: Record<string, Record<'ar' | 'en', LocalizedProductInfo>> = {
  
};

/**
 * Returns localized name and description for any product based on current app language.
 */
export function getProductLocalizedDetails(
  product: Product,
  lang: AppLanguage | string = 'fr'
): { name: string; description: string; category: string; origin: string } {
  if (lang === 'fr') {
    return {
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      origin: product.origin || '',
    };
  }

  const translations = PRODUCT_TRANSLATIONS[product.id] || PRODUCT_TRANSLATIONS[product.code];
  if (translations && translations[lang]) {
    const localized = translations[lang];
    return {
      name: localized.name || product.name,
      description: localized.description || product.description || '',
      category: localized.category || product.category || '',
      origin: localized.origin || product.origin || '',
    };
  }

  return {
    name: product.name,
    description: product.description || '',
    category: product.category || '',
    origin: product.origin || '',
  };
}
