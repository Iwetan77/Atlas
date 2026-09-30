import type { DisplayCurrency, Money } from '@/api/contract';

const LOCALES: Record<DisplayCurrency, string> = {
  NGN: 'en-NG',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
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

// Gains and losses: always signed, "+₦1,500.00" / "−₦1,500.00".
export function formatSignedMoney(money: Money): string {
  const n = Number(money.amount);
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${formatMoney({ ...money, amount: String(Math.abs(n)) })}`;
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

// Spelled out rather than read from Intl: Hermes on iOS has no NumberFormat.formatToParts.
const SYMBOLS: Record<DisplayCurrency, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
  KES: 'KSh',
  GHS: 'GH₵',
  ZAR: 'R',
};

// "₦", "$", "KSh"… for amount inputs that show the symbol beside a bare number.
export function currencySymbol(currency: DisplayCurrency): string {
  return SYMBOLS[currency] ?? currency;
}

// Unit prices: memecoins trade far below 1, so small prices keep significant digits
// (₦0.02830) instead of rounding to ₦0.03.
export function formatPrice(money: Money): string {
  const n = Number(money.amount);
  if (n === 0 || Math.abs(n) >= 1) return formatMoney(money);
  return new Intl.NumberFormat(LOCALES[money.currency], {
    style: 'currency',
    currency: money.currency,
    maximumSignificantDigits: 4,
  }).format(n);
}

// "10000.5" → "10,000.5" for amount inputs; keeps a trailing "." or decimals the user is typing.
export function groupDigits(raw: string): string {
  const [whole, frac] = raw.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

// Shows the engine's amount digit for digit (grouped, never rounded). Used where the value must
// match the engine exactly, e.g. a perp's liquidation price.
export function formatExactMoney(money: Money): string {
  const negative = money.amount.startsWith('-');
  const digits = negative ? money.amount.slice(1) : money.amount;
  return `${negative ? '-' : ''}${currencySymbol(money.currency)}${groupDigits(digits)}`;
}

// Short form for tight spaces: ₦85,343,731.37 → ₦85.34M. Display only; never for values that must
// match the engine exactly.
export function formatCompactMoney(money: Money): string {
  return new Intl.NumberFormat(LOCALES[money.currency], {
    style: 'currency',
    currency: money.currency,
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(Number(money.amount));
}
