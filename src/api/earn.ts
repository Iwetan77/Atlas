import { useCallback, useEffect, useState } from 'react';

import { engineGet, enginePost, SAFE_TO_REPLAY } from '@/api/client';
import type { EarnAction, EarnOption, EarnPosition, EarnQuote, ExecutionPlan } from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { useSettings } from '@/settings/context';

type Token = () => Promise<string | null>;

// What Atlas can earn on, and what the user already has earning.
export function useEarn() {
  const { authenticated, getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const [options, setOptions] = useState<EarnOption[] | null>(null);
  const [positions, setPositions] = useState<EarnPosition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!authenticated) return Promise.resolve();
    return getAccessToken()
      .then((token) =>
        Promise.all([
          engineGet<{ options: EarnOption[] }>(`/v1/earn/options?currency=${displayCurrency}`, token),
          engineGet<{ positions: EarnPosition[] }>(`/v1/earn/positions?currency=${displayCurrency}`, token),
        ]),
      )
      .then(
        ([o, p]) => {
          setOptions(o.options);
          setPositions(p.positions);
          setError(null);
        },
        (e) => setError(errorMessage(e)),
      );
  }, [authenticated, getAccessToken, displayCurrency]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { options, positions, error, reload };
}

export async function requestEarnQuote(
  token: Token,
  req: { optionId: string; action: EarnAction; amount: { amount: string; currency: string } },
): Promise<EarnQuote> {
  return enginePost<EarnQuote>('/v1/earn/quotes', await token(), req, SAFE_TO_REPLAY);
}

export async function executeEarnQuote(token: Token, quoteId: string): Promise<ExecutionPlan> {
  return enginePost<ExecutionPlan>(`/v1/earn/quotes/${encodeURIComponent(quoteId)}/execute`, await token(), {}, SAFE_TO_REPLAY);
}
