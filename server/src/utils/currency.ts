/**
 * Currency utilities for paise integer accounting
 * 1 Rupee = 100 Paise
 */

export function rupeesToPaise(rupees: number | string): number {
  const num = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(num) || !isFinite(num) || num < 0) {
    throw new Error('Amount must be a non-negative finite number');
  }
  return Math.round(num * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatINR(paise: number, options?: { showPaise?: boolean }): string {
  const rupees = paise / 100;
  const isNegative = rupees < 0;
  const absRupees = Math.abs(rupees);
  
  const hasDecimal = options?.showPaise || (paise % 100 !== 0);
  const formatted = absRupees.toLocaleString('en-IN', {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return `${isNegative ? '-' : ''}₹${formatted}`;
}
