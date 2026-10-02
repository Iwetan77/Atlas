import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { engineGet } from '@/api/client';
import type { Money } from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { useSettings } from '@/settings/context';

export type TransactionReceipt = {
  id: string; intentId: string | null; kind: string; title: string; symbol: string;
  assetId: string | null; iconUrl: string | null; createdAtUnixMs: number;
  state: 'pending' | 'filled' | 'failed'; stage: string; amount: Money | null;
  txIds: string[]; error: string | null; summary: { label: string; value: string }[];
};
type Page = { transactions: TransactionReceipt[]; nextCursor: string | null };

// Poll only while the screen is visible, and never let an older response replace a newer one.
export function useTransactions(limit = 6) {
  const { authenticated, getAccessToken, userId } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const [snapshot, setSnapshot] = useState<{ owner: string | null; currency: string; data: TransactionReceipt[] | null; error: string | null; cursor: string | null }>({ owner: userId, currency: displayCurrency, data: null, error: null, cursor: null });
  const current = authenticated && snapshot.owner === userId && snapshot.currency === displayCurrency;
  const data = current ? snapshot.data : null;
  const error = current ? snapshot.error : null;
  const cursor = current ? snapshot.cursor : null;
  const [loadingMore, setLoadingMore] = useState(false);
  const active = useRef(false);
  const epoch = useRef(0);
  const busy = useRef(false);
  const moreBusy = useRef(false);

  const reload = useCallback(async () => {
    if (!authenticated || busy.current) return;
    busy.current = true;
    const version = epoch.current;
    try {
      const page = await engineGet<Page>(`/v1/transactions?currency=${displayCurrency}&limit=${limit}`, await getAccessToken(), { timeoutMs: 15000 });
      if (!active.current || version !== epoch.current) return;
      setSnapshot((old) => {
        const fresh = old.owner !== userId || old.currency !== displayCurrency || !old.data || limit === 6;
        return { owner: userId, currency: displayCurrency, data: fresh ? page.transactions : merge(page.transactions, old.data ?? []), cursor: fresh ? page.nextCursor : old.cursor, error: null };
      });
    } catch (e) { if (active.current && version === epoch.current) setSnapshot((old) => ({ ...old, owner: userId, currency: displayCurrency, data: old.owner === userId && old.currency === displayCurrency ? old.data : null, cursor: old.owner === userId && old.currency === displayCurrency ? old.cursor : null, error: errorMessage(e) })); }
    finally { busy.current = false; }
  }, [authenticated, displayCurrency, getAccessToken, limit, userId]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    void reload();
    const timer = setInterval(() => void reload(), 12000);
    return () => { active.current = false; epoch.current++; clearInterval(timer); };
  }, [reload]));

  const loadMore = useCallback(async () => {
    if (!cursor || moreBusy.current) return;
    moreBusy.current = true; setLoadingMore(true);
    const version = epoch.current;
    try {
      const page = await engineGet<Page>(`/v1/transactions?currency=${displayCurrency}&limit=${limit}&cursor=${encodeURIComponent(cursor)}`, await getAccessToken(), { timeoutMs: 15000 });
      if (!active.current || version !== epoch.current) return;
      setSnapshot((old) => ({ owner: userId, currency: displayCurrency, data: merge(old.data ?? [], page.transactions), cursor: page.nextCursor, error: null }));
    } catch (e) { if (active.current && version === epoch.current) setSnapshot((old) => ({ ...old, owner: userId, currency: displayCurrency, data: old.owner === userId && old.currency === displayCurrency ? old.data : null, cursor: old.owner === userId && old.currency === displayCurrency ? old.cursor : null, error: errorMessage(e) })); }
    finally { moreBusy.current = false; setLoadingMore(false); }
  }, [cursor, displayCurrency, getAccessToken, limit, userId]);
  return { data, error, reload, loadMore, hasMore: !!cursor, loadingMore };
}
function merge(first: TransactionReceipt[], second: TransactionReceipt[]) {
  return [...new Map([...second, ...first].map((r) => [r.id, r])).values()]
    .sort((a, b) => b.createdAtUnixMs - a.createdAtUnixMs || b.id.localeCompare(a.id));
}

export function receiptState(r: TransactionReceipt) {
  if (r.state === 'filled') return 'Completed';
  if (r.state === 'failed') return 'Needs attention';
  if (r.stage === 'sign') return 'Waiting for approval';
  if (r.stage === 'validate') return 'Awaiting confirmation';
  return 'Pending';
}
export function receiptDate(ms: number) {
  if (!ms) return '';
  const date = new Date(ms);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
