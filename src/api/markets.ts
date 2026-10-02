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
  // A search's second part (other chains, Base coins by name) is still on its way.
  const [more, setMore] = useState(false);
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
    const stale = () => ticket !== latest.current;
    setLoading(true);
    setError(null);
    setMore(false);
    const url = (part?: 'listed' | 'other') => {
      const params = new URLSearchParams({ currency: displayCurrency, category });
      if (search) params.set('q', search);
      if (part) params.set('part', part);
      return `/v1/assets?${params}`;
    };
    try {
      const token = await getAccessToken();
      if (stale()) return;
      if (!search) {
        const res = await engineGet<AssetsResponse>(url(), token, { timeoutMs: SEARCH_TIMEOUT_MS });
        if (stale()) return;
        setAssets(res.assets);
        setIncomplete(false);
        return;
      }
      // A search answers in two parts: Atlas's own coins show as soon as they're found, and other
      // chains (and Base coins by name) join the list when they arrive.
      const other = () =>
        engineGet<AssetsResponse>(url('other'), token, { timeoutMs: SEARCH_TIMEOUT_MS }).catch((e: unknown) => e as Error);
      const pending = other();
      setMore(true);
      let listed: MarketAsset[] = [];
      let listedError: unknown = null;
      try {
        listed = (await engineGet<AssetsResponse>(url('listed'), token, { timeoutMs: SEARCH_TIMEOUT_MS })).assets;
      } catch (e) {
        listedError = e;
      }
      if (stale()) return;
      setAssets(listed);
      setSettledKey(key);
      setLoading(false);
      let rest = await pending;
      if (stale()) return;
      // One retry when the other chains came back empty-handed, before calling it a failed search.
      if (rest instanceof Error || (rest.assets.length === 0 && rest.searchComplete === false && listed.length === 0)) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        if (stale()) return;
        rest = await other();
        if (stale()) return;
      }
      const found = rest instanceof Error ? [] : rest.assets.filter((a) => !listed.some((l) => l.assetId === a.assetId));
      const all = [...listed, ...found];
      setAssets(all);
      setIncomplete(rest instanceof Error || rest.searchComplete === false);
      if (all.length === 0 && (rest instanceof Error || rest.searchComplete === false || listedError)) {
        const cause = listedError ?? (rest instanceof Error ? rest : null);
        setError(
          cause instanceof EngineTimeout
            ? 'Search is taking too long. Try again.'
            : cause
              ? errorMessage(cause)
              : "Some results couldn't load. Try again in a moment.",
        );
      }
    } catch (e) {
      if (stale()) return;
      setError(e instanceof EngineTimeout ? 'Search is taking too long. Try again.' : errorMessage(e));
    } finally {
      if (!stale()) {
        setSettledKey(key);
        setLoading(false);
        setMore(false);
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
  return {
    assets: current ? assets : null,
    error: current ? error : null,
    loading: loading || !current,
    incomplete: current && incomplete,
    searchingMore: current && more,
    reload: load,
  };
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
