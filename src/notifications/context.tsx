
import { createContext, type ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useNotificationDevice } from '@/notifications/device';
import { engineGet, enginePost } from '@/api/client';
import { errorMessage, useAtlasAuth } from '@/auth/context';

export type MoneyNotice = { id: string; title: string; body: string; url: string; createdAt: number; read: boolean; warning: boolean };
type Inbox = { items: MoneyNotice[]; unread: number; hasMore: boolean };
type Updates = { device: ReturnType<typeof useNotificationDevice>; inbox: Inbox; loading: boolean; error: string | null; reload: () => Promise<void>; read: (id?: string) => Promise<void>; more: () => Promise<void> };
const EMPTY: Inbox = { items: [], unread: 0, hasMore: false };
const Context = createContext<Updates | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { authenticated, userId, getAccessToken } = useAtlasAuth();
  const [saved, setSaved] = useState<{ owner: string; inbox: Inbox } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = useRef(userId);
  useLayoutEffect(() => { owner.current = userId; }, [userId]);
  const inbox = authenticated && saved?.owner === userId ? saved.inbox : EMPTY;
  const fetchInbox = useCallback(async (before?: number, beforeId?: string) => {
    if (!authenticated || !userId) return;
    const current = userId;
    if (before === undefined) setLoading(true);
    try {
      const answer = await engineGet<Inbox>('/v1/notifications' + (before === undefined ? '' : '?before=' + before + '&beforeId=' + encodeURIComponent(beforeId ?? '~')),
        await getAccessToken(), { timeoutMs: 15_000 });
      if (owner.current !== current) return;
      setSaved((last) => {
        if (!last || last.owner !== current) return { owner: current, inbox: answer };
        if (before !== undefined) return { owner: current, inbox: { ...answer,
          items: [...last.inbox.items, ...answer.items.filter((n) => !last.inbox.items.some((old) => old.id === n.id))] } };
        if (last.inbox.items.length <= 40) return { owner: current, inbox: answer };
        return { owner: current, inbox: { ...answer, hasMore: last.inbox.hasMore,
          items: [...answer.items, ...last.inbox.items.filter((n) => !answer.items.some((fresh) => fresh.id === n.id))] } };
      });
      setError(null);
    } catch (e) {
      if (owner.current === current) setError(errorMessage(e));
    } finally { if (owner.current === current) setLoading(false); }
  }, [authenticated, userId, getAccessToken]);
  const reload = useCallback(() => fetchInbox(), [fetchInbox]);
  useEffect(() => {
    if (!authenticated) {
      const reset = setTimeout(() => { setSaved(null); setError(null); }, 0);
      return () => clearTimeout(reset);
    }
    const initial = setTimeout(reload, 0);
    const timer = setInterval(() => { if (AppState.currentState === 'active') void reload(); }, 30_000);
    const change = AppState.addEventListener('change', (state) => { if (state === 'active') void reload(); });
    return () => { clearTimeout(initial); clearInterval(timer); change.remove(); };
  }, [authenticated, reload]);
  const read = async (id?: string) => {
    if (!userId) return;
    const current = userId;
    await enginePost('/v1/notifications/read', await getAccessToken(), { id: id ?? null }, { retries: 2, timeoutMs: 15_000 });
    if (owner.current !== current) return;
    setSaved((last) => {
      if (!last || last.owner !== current) return last;
      const changed = last.inbox.items.filter((n) => !n.read && (!id || n.id === id)).length;
      return { ...last, inbox: { ...last.inbox, items: last.inbox.items.map((n) => !id || n.id === id ? { ...n, read: true } : n),
        unread: id ? Math.max(0, last.inbox.unread - changed) : 0 } };
    });
  };
  const device = useNotificationDevice(userId, authenticated, getAccessToken, reload);
  return <Context.Provider value={{ device, inbox, loading, error, reload, read,
    more: () => fetchInbox(inbox.items.at(-1)?.createdAt, inbox.items.at(-1)?.id) }}>{children}</Context.Provider>;
}
export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error('NotificationsProvider is missing');
  return value;
}
