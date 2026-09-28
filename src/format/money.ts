import type { DisplayCurrency, Money } from '@/api/contract';

const LOCALES: Record<DisplayCurrency, string> = {
  NGN: 'en-NG',
  USD: 'en-US',
  KES: 'en-KE',
  GHS: 'en-GH',
  ZAR: 'en-ZA',
};

// Display only. Amounts arrive as decimal strings from the engine; nothing here does arithmetic.
export function formatMoney(money: Money): string {
  return new Intl.NumberFormat(LOCALES[money.currency], {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(money.amount));
}

export function formatUsd(amount: string): string {
  return formatMoney({ amount, currency: 'USD' });
}

// Token amounts: trim trailing zeros, cap at 6 decimals ("0.100000" → "0.1").
export function formatTokenNumber(amount: string): string {
  const n = Number(amount);
  const digits = n !== 0 && Math.abs(n) < 0.0001 ? 8 : 6;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n);
}

export function formatTokenAmount(amount: string, symbol: string): string {
  return `${formatTokenNumber(amount)} ${symbol}`;
}

export const HIDDEN = '••••••';
