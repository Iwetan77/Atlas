import { engineGet, enginePost, SAFE_TO_REPLAY } from '@/api/client';
import { createReadCache } from '@/api/read-cache';
import type { ExecutionPlan, Money, WithdrawNetworks, WithdrawQuote } from '@/api/contract';

type Token = () => Promise<string | null>;

// Public selector metadata contains no account data. A brief shared read avoids
// waiting for the wallet SDK or fetching twice when the sheet and screen both mount.
const networkReads = createReadCache<WithdrawNetworks>(60_000, 1);
export function listWithdrawNetworks(_token?: Token): Promise<WithdrawNetworks> {
  return networkReads.read('/v1/withdrawals/networks', () =>
    engineGet<WithdrawNetworks>('/v1/withdrawals/networks', null,
      { auth: false, timeoutMs: 15_000, retries: 0 }));
}

export async function requestWithdrawQuote(
  token: Token,
  req: { networkId: string; address: string; amount: Money },
): Promise<WithdrawQuote> {
  return enginePost<WithdrawQuote>('/v1/withdrawals/quote', await token(), req, SAFE_TO_REPLAY);
}

export async function executeWithdraw(token: Token, quoteId: string): Promise<ExecutionPlan> {
  return enginePost<ExecutionPlan>(`/v1/withdrawals/quote/${encodeURIComponent(quoteId)}/execute`, await token(), {}, SAFE_TO_REPLAY);
}
