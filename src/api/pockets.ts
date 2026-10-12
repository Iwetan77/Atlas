import { useBalance } from '@/api/balance';
import type { BalanceResponse, Money } from '@/api/contract';

// The two balances inside the one on Home. Spendable is cash in the Base wallet: it pays sends,
// cash-outs and savings. Trading is cash in the Solana wallet: it pays trades, perps and predictions.
// Engines from before this split don't send them, so they're read from the holdings the same way.
function walletCash(balance: BalanceResponse, chain: 'base' | 'solana'): number {
  return balance.holdings
    .filter((h) => h.kind === 'cash' && (h.location ?? 'wallet') === 'wallet' && h.chain === chain)
    .reduce((sum, h) => sum + Number(h.value.amount), 0);
}

export function spendableAmount(balance: BalanceResponse): number {
  return balance.spendable ? Number(balance.spendable.amount) : walletCash(balance, 'base');
}

export function tradingAmount(balance: BalanceResponse): number {
  return balance.trading ? Number(balance.trading.amount) : walletCash(balance, 'solana');
}

// Whether the engine keeps Spendable and Trading apart and can move money between them. An engine
// from before that leaves the two fields out; the app then shows them but offers no moves.
export function pocketsLive(balance: BalanceResponse): boolean {
  return balance.spendable !== undefined && balance.trading !== undefined;
}

export function pocketMoney(balance: BalanceResponse, amount: number): Money {
  return { amount: amount.toFixed(2), currency: balance.total.currency };
}

// The rest of the balance: savings, perps margin, predictions and coins.
export function elsewhereAmount(balance: BalanceResponse): number {
  return Math.max(0, Number(balance.total.amount) - spendableAmount(balance) - tradingAmount(balance));
}

// How much more a trade of `amount` (display currency) needs in Trading, for an Add money button to
// fill in. Undefined until the balance is known. Room for the trade's own costs, which are partly a
// share and partly fixed (moving margin, a network fee reserve): 3% and about $0.25, so one Add is
// normally enough. The person can still change it before moving.
export function useTradingShortfall(amount: number): number | undefined {
  const { data } = useBalance();
  if (!data || !(amount > 0)) return undefined;
  const perDollar = Number(data.totalUsd) > 0 ? Number(data.total.amount) / Number(data.totalUsd) : 0;
  return Math.max(0, amount * 1.03 + 0.25 * perDollar - tradingAmount(data));
}
