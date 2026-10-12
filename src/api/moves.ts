import { enginePost, SAFE_TO_REPLAY } from '@/api/client';
import type { ExecutionPlan, Money, MoveDirection, MoveQuote } from '@/api/contract';

type Token = () => Promise<string | null>;

export async function requestMoveQuote(
  token: Token,
  req: { direction: MoveDirection; amount: Money; all?: boolean },
): Promise<MoveQuote> {
  return enginePost<MoveQuote>('/v1/moves/quote', await token(), req, SAFE_TO_REPLAY);
}

export async function executeMove(token: Token, quoteId: string): Promise<ExecutionPlan> {
  return enginePost<ExecutionPlan>(`/v1/moves/quotes/${encodeURIComponent(quoteId)}/execute`, await token(), {}, SAFE_TO_REPLAY);
}
