/**
 * Lightweight DZD Currency Formatter
 * Extracted into a standalone utility to decouple components from heavy PDF generators (jsPDF/html2canvas).
 */
export const formatDZD = (amount: number): string => {
  const formatted = new Intl.NumberFormat('fr-DZ', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  // Replace any runtime thousands-separator slashes with clean periods
  return formatted.replace(/\//g, '.') + ' DA';
};
