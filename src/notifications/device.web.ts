
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

import { engineGet } from '@/api/client';
import { errorMessage, withTimeout } from '@/auth/context';
import { registerDevice, rememberedDevice, removeDevice } from '@/notifications/registration';

const supported = () => typeof window !== 'undefined' && window.isSecureContext &&
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
let prepared: Promise<ServiceWorkerRegistration> | null = null;
function registration() {
  if (!prepared) prepared = withTimeout(navigator.serviceWorker.register('/atlas-push-sw.js', { scope: '/' })
    .then(() => navigator.serviceWorker.ready), 15_000, 'Notifications').catch((e) => { prepared = null; throw e; });
  return prepared;
}
function publicKey(text: string) {
  const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
export async function disconnectNotifications(getToken: () => Promise<string | null>) {
  if (supported()) {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/atlas-push-sw.js');
      const subscription = await reg?.pushManager.getSubscription();
      await subscription?.unsubscribe();
    } catch { /* A browser notification error must not block sign-out. */ }
  }
  await removeDevice(getToken).catch(() => {});
}
export function useNotificationDevice(owner: string | null, authenticated: boolean,
  getToken: () => Promise<string | null>, onUpdate: () => Promise<void>) {
  const available = useSyncExternalStore(() => () => {}, supported, () => false);
  const session = useRef(owner);
  useLayoutEffect(() => { session.current = authenticated ? owner : null; }, [owner, authenticated]);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const bind = useCallback(async (subscription: PushSubscription) => {
    if (!owner || session.current !== owner) return;
    const token = await getToken();
    if (session.current !== owner) return;
    await registerDevice(owner, 'web', subscription.toJSON(), token, () => session.current === owner);
    if (session.current !== owner) throw new Error('Sign in again to enable notifications.');
  }, [owner, getToken]);
  useEffect(() => {
    if (!available || !authenticated || !owner) return;
    let live = true;
    void Promise.resolve().then(async () => {
      if (!live) return null;
      setEnabled(false); setError(null);
      return registration();
    }).then(async (reg) => {
      if (!reg || !live) return;
      const subscription = await reg.pushManager.getSubscription();
      const saved = rememberedDevice();
      // Browser permission and the subscription survive storage updates. Rebind an existing
      // subscription even when Atlas's local registration id was cleared; never silently discard it.
      if (subscription && saved?.owner && saved.owner !== owner) {
        await subscription.unsubscribe(); return;
      }
      if (subscription && Notification.permission === 'granted') {
        await bind(subscription);
        if (live && session.current === owner) setEnabled(true);
      }
    }).catch((e) => { if (live && session.current === owner) setError(errorMessage(e)); });
    const message = (event: MessageEvent) => { if (event.data?.type === 'atlas-money-update') void onUpdate(); };
    navigator.serviceWorker.addEventListener('message', message);
    return () => { live = false; navigator.serviceWorker.removeEventListener('message', message); };
  }, [owner, authenticated, available, bind, onUpdate]);
  const change = async (on: boolean) => {
    if (working.current || !supported() || !owner) return;
    const current = owner;
    working.current = true;
    // Ask inside the button gesture. Safari must not lose the gesture to a network request.
    const permission = on ? Notification.requestPermission() : Promise.resolve(Notification.permission);
    setBusy(true); setError(null);
    try {
      if (!on) { await disconnectNotifications(getToken); setEnabled(false); return; }
      if (await permission !== 'granted') throw new Error('Allow notifications for Atlas in your browser’s website settings.');
      const token = await getToken();
      if (session.current !== current) return;
      const config = await engineGet<{ publicKey: string }>('/v1/notifications/config', token, { timeoutMs: 15_000 });
      if (session.current !== current) return;
      const reg = await registration();
      if (session.current !== current) return;
      let subscription = await reg.pushManager.getSubscription();
      const key = publicKey(config.publicKey);
      if (subscription && subscription.options.applicationServerKey &&
        btoa(String.fromCharCode(...new Uint8Array(subscription.options.applicationServerKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== config.publicKey) {
        await subscription.unsubscribe(); subscription = null;
      }
      subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key.buffer as ArrayBuffer });
      if (session.current !== current) return;
      await bind(subscription); if (session.current === current) setEnabled(true);
    } catch (e) { if (session.current === current) { setEnabled(false); setError(errorMessage(e)); } }
    finally { working.current = false; setBusy(false); }
  };
  return { enabled: authenticated && rememberedDevice()?.owner === owner && enabled, busy, error, available, change,
    explanation: available ? 'Money updates, even when Atlas is closed.' : 'On iPhone, add Atlas to your Home Screen, then enable notifications there. Other browsers must support notifications.' };
}
