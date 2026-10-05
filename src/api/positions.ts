import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { engineGet } from '@/api/client';
import type { SpotPosition, SpotPositions } from '@/api/contract';
import { errorMessage, useAtlasAuth, withTimeout } from '@/auth/context';
import { useSettings } from '@/settings/context';

export type SpotPositionsState = {
  data: SpotPosition[] | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
};

type Snapshot = Omit<SpotPositionsState, 'reload'>;
const EMPTY: Snapshot = { data: null, error: null, loading: false };
const listeners = new Set<() => void>();
const snapshots = new Map<string, Snapshot>();
const requests = new Map<string, Promise<void>>();
let owner: string | null = null;
let generation = 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function notify() { listeners.forEach((listener) => listener()); }
function setOwner(next: string | null) {
  if (owner === next) return;
  owner = next;
  generation++;
  snapshots.clear();
  requests.clear();
  notify();
}

// Home, Trade and theme remounts share the last successful P&L, scoped to the user and currency.
// An unavailable refresh keeps it; a successful empty answer removes sold positions.
export function useSpotPositions(): SpotPositionsState {
  const { authenticated, userId, getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const state = useSyncExternalStore(
    subscribe,
    () => authenticated && userId === owner ? snapshots.get(displayCurrency) ?? EMPTY : EMPTY,
    () => EMPTY,
  );

  const reload = useCallback(() => {
    setOwner(authenticated ? userId : null);
    if (!authenticated || !userId) return Promise.resolve();
    const pending = requests.get(displayCurrency);
    if (pending) return pending;
    const mine = generation;
    snapshots.set(displayCurrency, { ...(snapshots.get(displayCurrency) ?? EMPTY), loading: true });
    notify();
    const request = withTimeout(
      getAccessToken().then((token) => engineGet<SpotPositions>(
        `/v1/positions/spot?currency=${displayCurrency}`, token, { timeoutMs: 25_000, retries: 0 },
      )),
      30_000, 'Your profit and loss',
    )
      .then(
        (next) => {
          if (mine !== generation) return;
          const unavailable = new Set(next.unavailableAssetIds ?? []);
          const received = new Set(next.positions.map((p) => p.assetId));
          const retained = (snapshots.get(displayCurrency)?.data ?? []).filter(
            (p) => unavailable.has(p.assetId) && !received.has(p.assetId),
          );
          snapshots.set(displayCurrency, { data: [...next.positions, ...retained], error: null, loading: false });
          notify();
        },
        (e) => {
          if (mine !== generation) return;
          snapshots.set(displayCurrency, { ...(snapshots.get(displayCurrency) ?? EMPTY), error: errorMessage(e), loading: false });
          notify();
        },
      )
      .finally(() => { if (mine === generation) requests.delete(displayCurrency); });
    requests.set(displayCurrency, request);
    return request;
  }, [authenticated, userId, getAccessToken, displayCurrency]);

  useEffect(() => { void reload(); }, [reload]);
  return { ...state, reload };
}
