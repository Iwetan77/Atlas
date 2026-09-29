import { useCallback, useEffect, useRef, useState } from 'react';

import { engineGet } from '@/api/client';
import type { BalanceResponse } from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { useSettings } from '@/settings/context';

// Deposits must show up on Home within a bounded time (Phase 2 gate), so the balance polls.
const POLL_MS = 15_000;

export type BalanceState = {
  data: BalanceResponse | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

export function useBalance(): BalanceState {
  const { authenticated, getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const [data, setData] = useState<BalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(() => {
    if (!authenticated || inFlight.current) return Promise.resolve();
    inFlight.current = true;
    return getAccessToken()
      .then((token) => engineGet<BalanceResponse>(`/v1/balance?currency=${displayCurrency}`, token))
      .then(
        (next) => {
          setData(next);
          setError(null);
        },
        (e) => {
          // Keep the last good balance on screen; a failed poll shouldn't blank it.
          console.warn('[atlas] balance refresh failed', e);
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        inFlight.current = false;
        setLoading(false);
      });
  }, [authenticated, getAccessToken, displayCurrency]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // A currency switch must never show the old currency's figures under the new label: until the
  // new currency's answer lands, there's no balance to show, only a load in progress.
  const current = data && data.total.currency === displayCurrency ? data : null;
  const switching = data !== null && current === null;
  return { data: current, error: switching ? null : error, loading: loading || switching, refresh };
}
