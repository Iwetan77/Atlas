import { engineGet, enginePost, SAFE_TO_REPLAY } from '@/api/client';
import type { ExecutionPlan, Money, WithdrawNetworks, WithdrawQuote } from '@/api/contract';

type Token = () => Promise<string | null>;

export async function listWithdrawNetworks(token: Token): Promise<WithdrawNetworks> {
  return engineGet<WithdrawNetworks>('/v1/withdrawals/networks', await token());
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
