import { useCallback, useEffect, useRef, useState } from 'react';

import { engineGet, enginePost, EngineTimeout, SAFE_TO_REPLAY } from '@/api/client';
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

// How long a search may take before it's called slow (the engine answers within a few seconds, leaving
// out any source that's slow).
const SEARCH_TIMEOUT_MS = 15_000;

export function useAssets(category: AssetCategory, query: string) {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const [assets, setAssets] = useState<MarketAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [incomplete, setIncomplete] = useState(false);
  const search = query.trim();
  const key = JSON.stringify([displayCurrency, category, search]);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only the latest request may update the list: a slow answer for "bon" never replaces "bonk".
  const latest = useRef(0);

  const cancel = useCallback(() => {
    if (debounce.current !== null) clearTimeout(debounce.current);
    debounce.current = null;
    latest.current++;
  }, []);

  const load = useCallback(async () => {
    // Submitting with the keyboard cancels the pending automatic search.
    cancel();
    const ticket = latest.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ currency: displayCurrency, category });
      if (search) params.set('q', search);
      const token = await getAccessToken();
      if (ticket !== latest.current) return;
      let res = await engineGet<AssetsResponse>(`/v1/assets?${params}`, token, {
        timeoutMs: SEARCH_TIMEOUT_MS,
      });
      if (ticket !== latest.current) return;
      // One retry for a partial empty answer, before calling it a failed search.
      if (search && res.assets.length === 0 && res.searchComplete === false) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        if (ticket !== latest.current) return;
        res = await engineGet<AssetsResponse>(`/v1/assets?${params}`, token, { timeoutMs: SEARCH_TIMEOUT_MS });
        if (ticket !== latest.current) return;
      }
      setAssets(res.assets);
      setIncomplete(res.searchComplete === false);
      if (search && res.assets.length === 0 && res.searchComplete === false) {
        setError("Some results couldn't load. Try again in a moment.");
      }
    } catch (e) {
      if (ticket !== latest.current) return;
      setError(e instanceof EngineTimeout ? 'Search is taking too long. Try again.' : errorMessage(e));
    } finally {
      if (ticket === latest.current) {
        setSettledKey(key);
        setLoading(false);
      }
    }
  }, [getAccessToken, displayCurrency, category, search, key, cancel]);

  useEffect(() => {
    // Typing shouldn't fire a request per keystroke; the keyboard's Search key runs it at once.
    debounce.current = setTimeout(load, search ? 350 : 0);
    // Retire the old request as soon as typing changes, before the next debounce fires.
    return cancel;
  }, [load, search, cancel]);

  const current = settledKey === key;
  return { assets: current ? assets : null, error: current ? error : null, loading: loading || !current, incomplete: current && incomplete, reload: load };
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
