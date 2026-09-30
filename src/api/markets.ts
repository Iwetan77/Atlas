import { useCallback, useEffect, useState } from 'react';

import { engineGet, enginePost, SAFE_TO_REPLAY } from '@/api/client';
import type { AssetCategory, AssetsResponse, ExecutionPlan, MarketAsset, Quote, QuoteRequest } from '@/api/contract';
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
  return enginePost<Quote>('/v1/quotes', await token(), req, SAFE_TO_REPLAY);
}

export async function executeQuote(token: Token, quoteId: string): Promise<ExecutionPlan> {
  return enginePost<ExecutionPlan>(`/v1/quotes/${encodeURIComponent(quoteId)}/execute`, await token(), {}, SAFE_TO_REPLAY);
}
