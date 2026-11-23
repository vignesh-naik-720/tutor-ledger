// Money minor-unit helpers (no floats allowed for ledger money)

export function roundHalfUp(num: number): number {
  return Math.floor(num + 0.5);
}

/**
 * Calculates a percentage change using integer basis points.
 * 100% = 10000 basis points. (e.g. 15% = 1500 bp)
 */
export function applyBasisPoints(amountMinor: number, basisPoints: number): number {
  return roundHalfUp((amountMinor * basisPoints) / 10000);
}

/**
 * Format minor unit to standard decimal string with currency symbol.
 */
export function formatMoney(amountMinor: number, currencyCode = 'INR', exponent = 2): string {
  const isNegative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const factor = Math.pow(10, exponent);
  const major = Math.floor(abs / factor);
  const minor = abs % factor;
  const minorStr = minor.toString().padStart(exponent, '0');
  const formatted = exponent > 0 ? `${major}.${minorStr}` : `${major}`;
  const sign = isNegative ? '-' : '';
  const symbol = getCurrencySymbol(currencyCode);
  return `${sign}${symbol}${formatted}`;
}

export function getCurrencySymbol(code: string): string {
  switch (code.toUpperCase()) {
    case 'INR':
      return '₹';
    case 'GBP':
      return '£';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    default:
      return `${code} `;
  }
}
