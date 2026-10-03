import { useCallback, useEffect, useState } from 'react';

import { engineGet, enginePost, SAFE_TO_REPLAY } from '@/api/client';
import type { ExecutionPlan, Money } from '@/api/contract';
import { useAtlasAuth } from '@/auth/context';

export type PredictionOutcome = { label: string; tokenId: string; probability: string };
export type PredictionMarket = {
  marketId: string; question: string; description: string; conditionId: string;
  outcomes: PredictionOutcome[]; iconUrl: string | null; endDate: string | null;
  volumeUsd: string; tradeable: boolean; closed: boolean; negRisk: boolean;
};
export type PredictionPosition = {
  positionId: string; tokenId: string; marketId: string; conditionId: string; question: string;
  outcome: string; shares: string; value: Money; pnl: Money; redeemable: boolean; iconUrl: string | null;
};
export type PredictionAccount = { wallet: string; cash: Money; cashUnits: string; deployed: boolean; positions: PredictionPosition[] };
export type PredictionQuote = {
  quoteId: string; marketId: string | null; tokenId: string | null; side: 'buy' | 'sell' | 'withdraw' | 'redeem';
  question: string; outcome: string | null; shares: string | null; pay: Money; receive: Money;
  potentialPayout: Money | null; price: Money; fee: Money; gasReserve: Money; expiresAtUnixMs: number;
};
export type PredictionAvailability = { configured: boolean; serverAllowed: boolean; deviceSubmission?: boolean; deviceAllowed?: boolean; serviceCountry?: string | null; blockedBy?: 'service_region' | 'builder_setup' | null; reason: string | null };
type Token = () => Promise<string | null>;

// Check the user's own connection too. A server in an allowed country cannot override a blocked user.
export async function predictionGeo(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch('https://polymarket.com/api/geoblock', { signal: controller.signal });
    if (!response.ok) throw new Error('Prediction availability could not be checked. Try again.');
    const body = await response.json();
    if (typeof body.blocked !== 'boolean') throw new Error('Prediction availability could not be checked.');
    return !body.blocked;
  } finally { clearTimeout(timeout); }
}

export function usePredictionMarkets(query: string) {
  const { authenticated, getAccessToken } = useAtlasAuth();
  const [markets, setMarkets] = useState<PredictionMarket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await engineGet<{ markets: PredictionMarket[] }>(
          '/v1/predictions/markets?q=' + encodeURIComponent(query.trim()), await getAccessToken(), { timeoutMs: 20_000 });
        if (active) { setMarkets(data.markets); setError(null); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Markets could not load.'); }
      finally { if (active) setLoading(false); }
    }, query ? 350 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [authenticated, getAccessToken, query, refresh]);
  return { markets, error, loading, reload: () => setRefresh((v) => v + 1) };
}
export async function predictionQuote(token: Token, input: {
  side: 'buy' | 'sell' | 'withdraw' | 'redeem'; marketId?: string; tokenId?: string; shares?: string;
  amount: Money; from?: 'base' | 'solana';
}): Promise<PredictionQuote> {
  const geoAllowed = await predictionGeo();
  if (!geoAllowed) throw new Error('Predictions trading is not available in your location.');
  return enginePost('/v1/predictions/quotes', await token(), { ...input, geoAllowed, deviceSubmission: true }, SAFE_TO_REPLAY);
}
export async function executePrediction(token: Token, id: string): Promise<ExecutionPlan> {
  if (!await predictionGeo()) throw new Error('Predictions trading is not available in your location.');
  return enginePost('/v1/predictions/quotes/' + encodeURIComponent(id) + '/execute', await token(), {}, SAFE_TO_REPLAY);
}
export function usePredictionAccount(currency: string) {
  const { authenticated, getAccessToken } = useAtlasAuth();
  const [account, setAccount] = useState<PredictionAccount | null>(null);
  const [availability, setAvailability] = useState<PredictionAvailability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!authenticated) return;
    try {
    const token = await getAccessToken();
    const [a, ready, location] = await Promise.allSettled([
      engineGet<PredictionAccount>('/v1/predictions/account?currency=' + currency, token, { timeoutMs: 20_000 }),
      engineGet<PredictionAvailability>('/v1/predictions/availability', token, { timeoutMs: 15_000 }),
      predictionGeo(),
    ]);
    if (a.status === 'fulfilled') { setAccount(a.value); setError(null); }
    else setError(a.reason instanceof Error ? a.reason.message : 'Predictions balance unavailable.');
    if (ready.status === 'fulfilled') {
      const deviceAllowed = location.status === 'fulfilled' && location.value;
      const reason = !ready.value.configured ? 'Atlas Predictions is waiting for its trading credentials.'
        : !ready.value.deviceSubmission ? 'Update Atlas to trade Predictions from your device.'
        : location.status === 'rejected' ? 'Your trading location could not be checked. Pull to refresh.'
        : !deviceAllowed ? 'Predictions trading is not available from your device connection.' : null;
      setAvailability({ ...ready.value, deviceAllowed, reason });
    }
    else setAvailability({ configured: false, serverAllowed: false, reason: 'Trading availability could not be checked. Pull to refresh.' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in again to load Predictions.');
      setAvailability({ configured: false, serverAllowed: false, reason: 'Trading availability could not be checked. Pull to refresh.' });
    }
  }, [authenticated, getAccessToken, currency]);
  useEffect(() => { const timer = setTimeout(() => { reload(); }, 0); return () => clearTimeout(timer); }, [reload]);
  return { account, availability, error, reload };
}
