import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { engineGet } from '@/api/client';
import type { Me } from '@/api/contract';
import { authorizePin, pinStatus, type PinAction, type PinAuthorization } from '@/api/pin';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { readDeviceValue, writeDeviceValue } from '@/auth/device-session';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { AppLock } from '@/security/app-lock';
import { PinPad } from '@/security/pin-pad';
import { PinSetup } from '@/security/pin-setup';
import { colors, radii, spacing, subscribeTheme, themedStyles, themeName } from '@/theme';

export class PinCancelled extends Error { constructor() { super('Cancelled'); } }
type Request = { action: PinAction; title: string; summary?: { label: string; value: string }[] };
type Waiting = Request & { resolve: (grant: PinAuthorization) => void; reject: (e: Error) => void };
const Context = createContext<{ request: (input: Request) => Promise<PinAuthorization>; reload: () => Promise<void> } | null>(null);
export function usePaymentPin() {
  const value = useContext(Context);
  if (!value) throw new Error('Payment PIN provider is missing');
  return value;
}
const readyKey = (userId: string) => `atlas.pinReady.${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
function pinReadyHere(userId: string) { return readDeviceValue(readyKey(userId)) === '1'; }
function rememberPinReady(userId: string, ready: boolean) { writeDeviceValue(readyKey(userId), ready ? '1' : null); }

export function PinProvider({ children }: { children: ReactNode }) {
  const { userId } = useAtlasAuth();
  return <PinSession key={userId ?? 'signed-out'}>{children}</PinSession>;
}
function PinSession({ children }: { children: ReactNode }) {
  // Its own screens redraw on a theme switch (keyed by it); its state, and the lock, stay.
  const theme = useSyncExternalStore(subscribeTheme, themeName, themeName);
  const { authenticated, userId, getAccessToken, logout } = useAtlasAuth();
  const insets = useSafeAreaInsets();
  const [account, setAccount] = useState<{ owner: string; handle: string | null; configured: boolean } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [checking, setChecking] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  // The PIN was just chosen: no need to ask for it again to open the app.
  const [justSetUp, setJustSetUp] = useState(false);
  const mounted = useRef(true);
  const active = useRef<Waiting | null>(null);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    if (!authenticated || !userId) return;
    const round = ++generation.current;
    try {
      const token = await getAccessToken();
      const [me, pin] = await Promise.all([engineGet<Me>('/v1/me', token, { timeoutMs: 15_000 }), pinStatus(async () => token)]);
      if (!mounted.current || generation.current !== round) return;
      setAccount({ owner: userId, handle: me.handle, configured: pin.configured }); setProblem(null);
    } catch (e) { if (mounted.current && generation.current === round) setProblem(errorMessage(e)); }
  }, [authenticated, userId, getAccessToken]);
  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(reload);
    return () => { mounted.current = false; active.current?.reject(new PinCancelled()); };
  }, [reload]);
  const request = useCallback((input: Request) => new Promise<PinAuthorization>((resolve, reject) => {
    if (active.current) { reject(new Error('Finish the current PIN request first.')); return; }
    const next = { ...input, resolve, reject }; active.current = next; setWaiting(next);
    setChecking(false); setPinError(null); setReset((n) => n+1);
  }), []);
  const cancel = () => {
    if (checking) return;
    active.current?.reject(new PinCancelled()); active.current = null; setWaiting(null);
  };
  const verify = async (pin: string) => {
    const pending = active.current;
    if (!pending || checking) return;
    setChecking(true); setPinError(null);
    try {
      const grant = await authorizePin(getAccessToken, pin, pending.action);
      if (!mounted.current || active.current !== pending) return;
      pending.resolve(grant); active.current = null; setWaiting(null);
    } catch (e) { if (active.current === pending) { setPinError(errorMessage(e)); setReset((n) => n+1); } }
    finally { setChecking(false); }
  };
  const mine = account?.owner === userId ? account : null;
  // Set up on this device before: open straight to the lock while the engine confirms it.
  const ready = mine ? mine.configured && !!mine.handle : !!userId && pinReadyHere(userId);
  const setup = authenticated && !ready;
  useEffect(() => {
    if (mine && userId) rememberPinReady(userId, mine.configured && !!mine.handle);
  }, [mine, userId]);
  return (
    <Context.Provider value={{ request, reload }}>
      {setup ? !mine ? (
        <View key={theme} testID="atlas-account-check" style={styles.loading}>
          {problem ? <><Text variant="heading">Securing your Atlas account</Text><Text color="danger">{problem}</Text><PillButton label="Try again" onPress={reload} /><PillButton label="Sign out" tone="secondary" onPress={logout} /></>
            : <><ActivityIndicator color={colors.accentPink} /><Text color="textSecondary">Securing your account…</Text></>}
        </View>
      ) : <PinSetup key={theme} handle={mine.handle} onDone={() => { setJustSetUp(true); void reload(); }} /> : (
        <AppLock active={authenticated} startLocked={!justSetUp} userId={userId} handle={mine?.handle ?? null}>{children}</AppLock>
      )}
      <Modal key={theme} visible={!!waiting} transparent animationType="slide" onRequestClose={cancel}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text variant="title">{waiting?.title ?? 'Payment PIN'}</Text>
              {waiting?.summary?.map((row) => <View key={row.label} style={styles.row}>
                <Text color="textSecondary">{row.label}</Text><Text variant="bodyStrong">{row.value}</Text>
              </View>)}
              <Text color="textSecondary">Enter your four-digit PIN to approve this action.</Text>
              <PinPad resetKey={reset} disabled={checking} onComplete={verify} />
              {checking ? <ActivityIndicator color={colors.accentPink} /> : null}
              {pinError ? <Text color="danger" accessibilityRole="alert">{pinError}</Text> : null}
              <PillButton label="Cancel" tone="secondary" disabled={checking} onPress={cancel} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Context.Provider>
  );
}
const styles = themedStyles(() => ({
  loading: { flex: 1, width: '100%', alignSelf: 'stretch', minHeight: '100%', backgroundColor: colors.bgBase, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.lg },
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: spacing.lg },
  sheet: { width: '100%', maxWidth: 440, maxHeight: '92%', alignSelf: 'center', borderRadius: radii.lg, backgroundColor: colors.bgSurface },
  content: { padding: spacing.xl, gap: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
}));
