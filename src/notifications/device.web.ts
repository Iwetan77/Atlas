
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
    const reg = await navigator.serviceWorker.getRegistration('/atlas-push-sw.js');
    const subscription = await reg?.pushManager.getSubscription();
    await subscription?.unsubscribe();
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
  const [error, setError] = useState<string | null>(null);
  const bind = useCallback(async (subscription: PushSubscription) => {
    if (!owner || session.current !== owner) return;
    const token = await getToken();
    if (session.current !== owner) return;
    await registerDevice(owner, 'web', subscription.toJSON(), token);
  }, [owner, getToken]);
  useEffect(() => {
    if (!available || !authenticated || !owner) return;
    let live = true;
    void registration().then(async (reg) => {
      const subscription = await reg.pushManager.getSubscription();
      const saved = rememberedDevice();
      const on = !!subscription && Notification.permission === 'granted' && saved?.owner === owner;
      if (live) setEnabled(on);
      if (on && subscription) await bind(subscription);
      else if (subscription && saved?.owner !== owner) await subscription.unsubscribe();
    }).catch(() => {});
    const message = () => { void onUpdate(); };
    navigator.serviceWorker.addEventListener('message', message);
    return () => { live = false; navigator.serviceWorker.removeEventListener('message', message); };
  }, [owner, authenticated, available, bind, onUpdate]);
  const change = async (on: boolean) => {
    if (busy || !supported() || !owner) return;
    // Ask inside the button gesture. Safari must not lose the gesture to a network request.
    const permission = on ? Notification.requestPermission() : Promise.resolve(Notification.permission);
    setBusy(true); setError(null);
    try {
      if (!on) { await disconnectNotifications(getToken); setEnabled(false); return; }
      if (await permission !== 'granted') throw new Error('Allow notifications for Atlas in your browser’s website settings.');
      const token = await getToken();
      const config = await engineGet<{ publicKey: string }>('/v1/notifications/config', token, { timeoutMs: 15_000 });
      const reg = await registration();
      let subscription = await reg.pushManager.getSubscription();
      const key = publicKey(config.publicKey);
      if (subscription && subscription.options.applicationServerKey &&
        btoa(String.fromCharCode(...new Uint8Array(subscription.options.applicationServerKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== config.publicKey) {
        await subscription.unsubscribe(); subscription = null;
      }
      subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key.buffer as ArrayBuffer });
      await bind(subscription); setEnabled(true);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return { enabled: authenticated && rememberedDevice()?.owner === owner && enabled, busy, error, available, change,
    explanation: available ? 'Money updates, even when Atlas is closed.' : 'On iPhone, add Atlas to your Home Screen, then enable notifications there. Other browsers must support notifications.' };
}
