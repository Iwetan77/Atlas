import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { engineGet } from '@/api/client';
import type { BalanceResponse } from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { useSettings } from '@/settings/context';

// Deposits must show up on Home within a bounded time (Phase 2 gate), so the balance polls.
const POLL_MS = 15_000;
const STORE_KEY = 'atlas.balance.v1';

export type BalanceState = {
  data: BalanceResponse | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

// One balance for the whole app: every screen reads the same answer, one poller keeps it fresh,
// and the last one is kept on the phone, so Home, Profile and Trade open showing it instead of
// waiting on the engine.
type Shared = { owner: string | null; data: BalanceResponse | null; error: string | null; settled: boolean };
let shared: Shared = { owner: null, data: null, error: null, settled: false };
let restored = false;
let inFlight = false;
const listeners = new Set<() => void>();

function publish(next: Partial<Shared>) {
  shared = { ...shared, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!restored) {
    restored = true;
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => {
        if (!raw || shared.data) return;
        const saved = JSON.parse(raw) as { owner: string; data: BalanceResponse };
        publish({ owner: saved.owner, data: saved.data });
      })
      .catch(() => {});
  }
  return () => {
    listeners.delete(listener);
  };
}

// One poller however many screens show the balance: started by the first, stopped by the last.
let pollers = 0;
let timer: ReturnType<typeof setInterval> | null = null;

export function useBalance(): BalanceState {
  const { authenticated, userId, getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const state = useSyncExternalStore(subscribe, () => shared);

  const refresh = useCallback(() => {
    if (!authenticated || !userId || inFlight) return Promise.resolve();
    inFlight = true;
    return getAccessToken()
      .then((token) => engineGet<BalanceResponse>(`/v1/balance?currency=${displayCurrency}`, token))
      .then(
        (next) => {
          publish({ owner: userId, data: next, error: null, settled: true });
          AsyncStorage.setItem(STORE_KEY, JSON.stringify({ owner: userId, data: next })).catch(() => {});
        },
        (e) => {
          // Keep the last good balance on screen; a failed poll shouldn't blank it.
          console.warn('[atlas] balance refresh failed', e);
          publish({ error: errorMessage(e), settled: true });
        },
      )
      .finally(() => {
        inFlight = false;
      });
  }, [authenticated, userId, getAccessToken, displayCurrency]);

  useEffect(() => {
    refresh();
    pollers += 1;
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, POLL_MS);
    return () => {
      pollers -= 1;
      if (pollers === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [refresh]);

  // Only this user's balance, and only in the currency on screen: a currency switch never shows the
  // old currency's figures under the new label.
  const mine = state.data && state.owner === userId ? state.data : null;
  const current = mine && mine.total.currency === displayCurrency ? mine : null;
  const switching = mine !== null && current === null;
  return {
    data: current,
    error: switching ? null : state.error,
    loading: !current && (!state.settled || switching),
    refresh,
  };
}
