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


// A single receipt follows the payout while its screen is open. A failed poll never means paid.
export function useTransactionReceipt(id: string) {
  const { authenticated, getAccessToken, userId } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const [stored, setStored] = useState<{ owner: string | null; currency: string; receipt: TransactionReceipt } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      if (!authenticated || !id) return;
      let terminal = false;
      try {
        const receipt = await engineGet<TransactionReceipt>(`/v1/transactions/${encodeURIComponent(id)}?currency=${displayCurrency}`, await getAccessToken(), { timeoutMs: 15000 });
        if (!active) return;
        setStored({ owner: userId, currency: displayCurrency, receipt });
        setError(null);
        terminal = receipt.state !== 'pending';
      } catch (e) { if (active) setError(errorMessage(e)); }
      if (active && !terminal) timer = setTimeout(() => void refresh(), 3000);
    }
    void refresh();
    return () => { active = false; if (timer) clearTimeout(timer); };
  // A manual refresh restarts the focused subscription, even after a terminal response.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, displayCurrency, getAccessToken, id, retry, userId]));
  const receipt = authenticated && stored?.owner === userId && stored.currency === displayCurrency && stored.receipt.id === id ? stored.receipt : null;
  return { receipt, error, reload: () => setRetry((n) => n + 1) };
}

export function bankTransferProgress(receipt: TransactionReceipt | null) {
  if (receipt?.state === 'filled') return { title: 'Transfer successful', detail: 'Your transfer has reached the bank.', step: 2, done: true, failed: false };
  if (receipt?.state === 'failed') return { title: 'Transfer needs attention', detail: receipt.error || 'Open the receipt for the latest update.', step: 0, done: false, failed: true };
  const payout = receipt?.summary.find((l) => l.label === 'Bank payout')?.value;
  if (payout === 'Being checked') return { title: 'Transfer being checked', detail: 'Your transfer is being reviewed. Follow its receipt for updates.', step: 1, done: false, failed: false };
  if (payout === 'Paying your bank') return { title: 'Paying your bank', detail: 'Your transfer is being delivered to the bank.', step: 1, done: false, failed: false };
  return { title: 'Sending your transfer', detail: 'We’ll update this screen when it reaches the bank.', step: 0, done: false, failed: false };
}
