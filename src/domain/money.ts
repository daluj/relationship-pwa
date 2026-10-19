import type { Debt } from './types';

/**
 * Net unsettled balance per currency (SPEC §8.7): positive = they owe you, negative = you owe.
 * Amounts are summed in minor units to avoid floating-point drift.
 */
export function balances(debts: Debt[]): Record<string, number> {
  const cents: Record<string, number> = {};
  for (const d of debts) {
    if (d.settledAt || d.deletedAt) continue;
    const v = Math.round(d.amount * 100) * (d.direction === 'they-owe' ? 1 : -1);
    cents[d.currency] = (cents[d.currency] ?? 0) + v;
  }
  return Object.fromEntries(
    Object.entries(cents)
      .filter(([, v]) => v !== 0)
      .map(([c, v]) => [c, v / 100]),
  );
}

export function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

const fallbackCurrencies = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
  'MXN',
  'ARS',
  'COP',
  'CLP',
  'BRL',
];

/** ISO 4217 codes offered in pickers. */
export function currencyCodes(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  try {
    return intl.supportedValuesOf?.('currency') ?? fallbackCurrencies;
  } catch {
    return fallbackCurrencies;
  }
}
