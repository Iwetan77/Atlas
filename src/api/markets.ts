import { useCallback, useEffect, useState } from 'react';

import { engineGet, enginePost, SAFE_TO_REPLAY } from '@/api/client';
import type {
  AssetCategory,
  AssetChart,
  AssetsResponse,
  ChartRange,
  ExecutionPlan,
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

// An asset's price history for one range; switching range keeps the last chart until the new one lands.
export function useAssetChart(assetId: string, range: ChartRange) {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const [chart, setChart] = useState<AssetChart | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const key = `${assetId}:${range}:${displayCurrency}`;

  useEffect(() => {
    let live = true;
    getAccessToken()
      .then((token) =>
        engineGet<AssetChart>(
          `/v1/assets/${encodeURIComponent(assetId)}/chart?range=${range}&currency=${displayCurrency}`,
          token,
        ),
      )
      .then(
        (next) => live && setChart(next),
        (e) => live && setError({ key, message: errorMessage(e) }),
      );
    return () => {
      live = false;
    };
  }, [assetId, range, displayCurrency, getAccessToken, key]);

  const current = chart && chart.range === range && chart.currency === displayCurrency ? chart : null;
  return { chart: current ?? chart, loading: !current && error?.key !== key, error: error?.key === key ? error.message : null };
}

export async function requestQuote(token: Token, req: QuoteRequest): Promise<Quote> {
  return enginePost<Quote>('/v1/quotes', await token(), req, SAFE_TO_REPLAY);
}

export async function executeQuote(token: Token, quoteId: string): Promise<ExecutionPlan> {
  return enginePost<ExecutionPlan>(`/v1/quotes/${encodeURIComponent(quoteId)}/execute`, await token(), {}, SAFE_TO_REPLAY);
}
