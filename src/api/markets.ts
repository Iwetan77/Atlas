import { useCallback, useEffect, useState } from 'react';

import { engineGet, enginePost } from '@/api/client';
import type {
  AssetCategory,
  AssetsResponse,
  ExecutionPlan,
  IntentStatus,
  IntentSubmission,
  MarketAsset,
  Quote,
  QuoteRequest,
} from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { useSettings } from '@/settings/context';

type Token = () => Promise<string | null>;

export function useAssets(category: AssetCategory, query: string) {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const [assets, setAssets] = useState<MarketAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ currency: displayCurrency, category });
      if (query.trim()) params.set('q', query.trim());
      const res = await engineGet<AssetsResponse>(`/v1/assets?${params}`, await getAccessToken());
      setAssets(res.assets);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, displayCurrency, category, query]);

  useEffect(() => {
    // Typing shouldn't fire a request per keystroke.
    const id = setTimeout(load, query ? 350 : 0);
    return () => clearTimeout(id);
  }, [load, query]);

  return { assets, error, loading, reload: load };
}

export async function requestQuote(token: Token, req: QuoteRequest): Promise<Quote> {
  return enginePost<Quote>('/v1/quotes', await token(), req);
}

export async function executeQuote(token: Token, quoteId: string): Promise<ExecutionPlan> {
  return enginePost<ExecutionPlan>(`/v1/quotes/${encodeURIComponent(quoteId)}/execute`, await token(), {});
}

export async function submitIntent(token: Token, intentId: string, body: IntentSubmission): Promise<IntentStatus> {
  return enginePost<IntentStatus>(`/v1/intents/${encodeURIComponent(intentId)}/signed`, await token(), body);
}

const SETTLE_POLL_MS = 2_000;
const SETTLE_TIMEOUT_MS = 120_000;

// Polls until the engine reports the intent filled or failed.
export async function waitForIntent(token: Token, first: IntentStatus): Promise<IntentStatus> {
  let status = first;
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  while (status.state === 'pending') {
    if (Date.now() > deadline) throw new Error('Still processing. Check your balance in a minute.');
    await new Promise((r) => setTimeout(r, SETTLE_POLL_MS));
    status = await engineGet<IntentStatus>(`/v1/intents/${encodeURIComponent(status.intentId)}`, await token());
  }
  return status;
}
