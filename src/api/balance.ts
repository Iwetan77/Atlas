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

  const refresh = useCallback(async () => {
    if (!authenticated || inFlight.current) return;
    inFlight.current = true;
    try {
      const token = await getAccessToken();
      const next = await engineGet<BalanceResponse>(`/v1/balance?currency=${displayCurrency}`, token);
      setData(next);
      setError(null);
    } catch (e) {
      // Keep the last good balance on screen; a failed poll shouldn't blank it.
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [authenticated, getAccessToken, displayCurrency]);

  useEffect(() => {
    // A currency switch must never show the old currency's figures under the new label.
    setData(null);
    setLoading(true);
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { data, error, loading, refresh };
}
