/**
 * Algerian Phone Utilities
 * Global default prefix: +213 (Algeria only)
 */

export const ALGERIA_COUNTRY_CODE = '+213';
export const ALGERIA_DIALING_CODE = '213';

/**
 * Normalizes any entered phone string to clean Algerian digits.
 * Handles inputs like:
 * - "+213 799 93 83 99" -> "0799938399"
 * - "213799938399" -> "0799938399"
 * - "799938399" -> "0799938399"
 * - "07 99 93 83 99" -> "0799938399"
 */
export function normalizeAlgerianPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // If already starts with 213
  if (digits.startsWith('213')) {
    const local = digits.slice(3);
    return local.startsWith('0') ? local : `0${local}`;
  }

  // If 9 digits (missing leading zero e.g. 799938399)
  if (digits.length === 9 && !digits.startsWith('0')) {
    return `0${digits}`;
  }

  return digits;
}

/**
 * Converts any phone into international WhatsApp format (213XXXXXXXXX)
 */
export function toAlgerianWhatsAppPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('213')) {
    return digits;
  }

  if (digits.startsWith('0')) {
    return `213${digits.slice(1)}`;
  }

  return `213${digits}`;
}

/**
 * Formats phone nicely with spaces: "07 99 93 83 99"
 */
export function formatAlgerianPhoneDisplay(phone?: string): string {
  const norm = normalizeAlgerianPhone(phone);
  if (!norm || norm.length < 10) return phone || '';

  // e.g. 07 99 93 83 99
  return `${norm.slice(0, 2)} ${norm.slice(2, 4)} ${norm.slice(4, 6)} ${norm.slice(6, 8)} ${norm.slice(8, 10)}`;
}

/**
 * Formats with international +213: "+213 7 99 93 83 99"
 */
export function formatAlgerianInternational(phone?: string): string {
  const norm = normalizeAlgerianPhone(phone);
  if (!norm) return '';
  const withoutZero = norm.startsWith('0') ? norm.slice(1) : norm;
  return `+213 ${withoutZero.slice(0, 1)} ${withoutZero.slice(1, 3)} ${withoutZero.slice(3, 5)} ${withoutZero.slice(5, 7)} ${withoutZero.slice(7, 9)}`.trim();
}

/**
 * Validates Algerian mobile or landline phone
 * Algerian mobile prefixes: 05, 06, 07
 * Landline: 02X, 03X, 04X
 */
export function isValidAlgerianPhone(phone?: string): boolean {
  const norm = normalizeAlgerianPhone(phone);
  if (!norm || norm.length !== 10) return false;
  return /^0[2-7][0-9]{8}$/.test(norm);
}
