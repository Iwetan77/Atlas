
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { errorMessage, withTimeout } from '@/auth/context';
import { registerDevice, rememberedDevice, removeDevice } from '@/notifications/registration';

Notifications.setNotificationHandler({ handleNotification: async () => ({
  shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true,
}) });
export async function disconnectNotifications(getToken: () => Promise<string | null>) {
  // Revoke the native transport even if the engine cannot be reached at sign-out.
  await Notifications.unregisterForNotificationsAsync().catch(() => {});
  await removeDevice(getToken).catch(() => {});
}
const allowed = (p: Notifications.NotificationPermissionsStatus) => p.granted ||
  p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
export function useNotificationDevice(owner: string | null, authenticated: boolean,
  getToken: () => Promise<string | null>, onUpdate: () => Promise<void>) {
  const available = Platform.OS !== 'android' || Constants.expoConfig?.extra?.androidPushConfigured === true;
  const session = useRef(owner);
  useLayoutEffect(() => { session.current = authenticated ? owner : null; }, [owner, authenticated]);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = useCallback(async () => {
    if (!owner || !available || session.current !== owner) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error('Atlas notification setup is not ready yet.');
    const push = await withTimeout(Notifications.getExpoPushTokenAsync({ projectId }), 15_000, 'Notifications');
    const token = await getToken();
    if (session.current !== owner) return;
    await registerDevice(owner, 'expo', { token: push.data }, token);
    setEnabled(true);
  }, [owner, available, getToken]);
  useEffect(() => {
    if (!authenticated || !owner) return;
    let live = true;
    const sync = async () => {
      try {
        const p = await Notifications.getPermissionsAsync();
        const saved = rememberedDevice();
        const on = available && allowed(p) && saved?.owner === owner;
        if (live) setEnabled(on);
        if (on) await bind();
      } catch { /* Inbox still works if remote push is unavailable. */ }
    };
    void sync();
    const changes = AppState.addEventListener('change', (state) => { if (state === 'active') void sync(); });
    const tokens = Notifications.addPushTokenListener(() => { if (rememberedDevice()?.owner === owner) void bind().catch(() => {}); });
    const updates = Notifications.addNotificationReceivedListener(() => { void onUpdate(); });
    const response = Notifications.addNotificationResponseReceivedListener(() => { router.push('/notifications'); void onUpdate(); });
    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (live && last) { router.push('/notifications'); void Notifications.clearLastNotificationResponseAsync(); }
    });
    return () => { live = false; changes.remove(); tokens.remove(); updates.remove(); response.remove(); };
  }, [authenticated, owner, available, bind, onUpdate]);
  const change = async (on: boolean) => {
    if (busy || !available || !owner) return;
    setBusy(true); setError(null);
    try {
      if (!on) { await disconnectNotifications(getToken); setEnabled(false); return; }
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('money', {
        name: 'Money updates', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 100, 200], lightColor: '#FF2E7E',
      });
      let permissions = await Notifications.getPermissionsAsync();
      if (!allowed(permissions)) permissions = await Notifications.requestPermissionsAsync();
      if (!allowed(permissions)) throw new Error('Allow notifications for Atlas in your phone’s settings.');
      await bind();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return { enabled: authenticated && rememberedDevice()?.owner === owner && enabled, busy, error, available, change,
    explanation: available ? 'Money updates, even when Atlas is closed.' : 'Android notifications are coming. Your updates are available here.' };
}
