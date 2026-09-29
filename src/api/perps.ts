import { useCallback, useEffect, useRef, useState } from 'react';

import { engineGet, enginePost, EngineUnavailable } from '@/api/client';
import type {
  ExecutionPlan,
  PerpAccount,
  PerpCloseQuote,
  PerpMarket,
  PerpOpenRequest,
  PerpQuote,
} from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { useSettings } from '@/settings/context';

type Token = () => Promise<string | null>;

// A 503 means the engine can't do this for anyone yet (e.g. venue signing not set up): say so plainly,
// and keep the engine's own reason in the console for whoever is debugging.
export function perpsError(e: unknown, notReady: string): string {
  if (e instanceof EngineUnavailable && e.status === 503) {
    console.warn('[atlas] perps not available:', e.message);
    return notReady;
  }
  return errorMessage(e);
}

// Mark prices and PnL move constantly; positions refresh on this cadence while visible.
const POSITIONS_POLL_MS = 10_000;

export function usePerpMarkets() {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const [markets, setMarkets] = useState<PerpMarket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await engineGet<{ markets: PerpMarket[] }>(`/v1/perps/markets?currency=${displayCurrency}`, await getAccessToken());
      setMarkets(res.markets);
      setError(null);
    } catch (e) {
      setError(perpsError(e, 'Perps markets are not available yet.'));
    }
  }, [getAccessToken, displayCurrency]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { markets, error, reload };
}

export function usePerpPositions(active: boolean) {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const [account, setAccount] = useState<PerpAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const reload = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setAccount(await engineGet<PerpAccount>(`/v1/perps/positions?currency=${displayCurrency}`, await getAccessToken()));
      setError(null);
    } catch (e) {
      setError(perpsError(e, 'Your perps account is not set up yet.'));
    } finally {
      inFlight.current = false;
    }
  }, [getAccessToken, displayCurrency]);

  useEffect(() => {
    if (!active) return;
    reload();
    const id = setInterval(reload, POSITIONS_POLL_MS);
    return () => clearInterval(id);
  }, [reload, active]);

  return { account, error, reload };
}

export async function requestPerpQuote(token: Token, req: PerpOpenRequest): Promise<PerpQuote> {
  return enginePost<PerpQuote>('/v1/perps/quotes', await token(), req);
}

export async function executePerpQuote(token: Token, quoteId: string): Promise<ExecutionPlan> {
  return enginePost<ExecutionPlan>(`/v1/perps/quotes/${encodeURIComponent(quoteId)}/execute`, await token(), {});
}

export async function requestCloseQuote(token: Token, positionId: string): Promise<PerpCloseQuote> {
  return enginePost<PerpCloseQuote>(`/v1/perps/positions/${encodeURIComponent(positionId)}/close-quote`, await token(), {});
}

export async function executeCloseQuote(token: Token, quoteId: string): Promise<ExecutionPlan> {
  return enginePost<ExecutionPlan>(`/v1/perps/close-quotes/${encodeURIComponent(quoteId)}/execute`, await token(), {});
}
