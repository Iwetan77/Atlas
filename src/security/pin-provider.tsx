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

// Privy's token can stall right after signing back in without restarting the app; waiting on it for
// good left "Securing your account…" up forever. Each try gives it a few seconds, the check tries a
// few times on its own, and then the screen says so, with Try again and Sign out.
const TOKEN_WAIT_MS = 6_000;
const TRIES = 3;
const STALLED = "Couldn't confirm your sign-in. Try again, or sign out and back in.";
function tokenWithin<T>(token: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(STALLED)), ms); });
  return Promise.race([token, late]).finally(() => clearTimeout(timer));
}

type Account = { owner: string; handle: string | null; configured: boolean };
// Who each person was last confirmed as during this run: a session rebuilt for them starts from it
// instead of checking from scratch (and showing "Securing your account" again).
const confirmed = new Map<string, Account>();

export function PinProvider({ children }: { children: ReactNode }) {
  const { userId } = useAtlasAuth();
  // One session per person. It stays mounted while Privy settles a sign-in (the user briefly gone and
  // back), which used to rebuild it and show "Securing your account" a second time, after the PIN.
  // Someone else signing in gets a fresh session; signing out locks this one (AppLock).
  const [person, setPerson] = useState(userId);
  if (userId && userId !== person) setPerson(userId);
  return <PinSession key={person ?? 'signed-out'} person={person}>{children}</PinSession>;
}
function PinSession({ person, children }: { person: string | null; children: ReactNode }) {
  // Its own screens redraw on a theme switch (keyed by it); its state, and the lock, stay. Each keeps
  // its own key: siblings sharing one (the theme's name) left the account check's spinner in the page
  // when it gave way to the lock, covering the app after the PIN until it was reopened.
  const theme = useSyncExternalStore(subscribeTheme, themeName, themeName);
  const auth = useAtlasAuth();
  const { authenticated, getAccessToken, logout } = auth;
  // Privy's website SDK reports "signed in" and the user separately, so a sign-in passes through a
  // moment of signed in with no user yet. That's still this session's person, not someone unknown:
  // treating it as unknown showed "Securing your account" (again, after the PIN) and rebuilt the lock.
  const userId = auth.userId ?? (authenticated ? person : null);
  const insets = useSafeAreaInsets();
  const [account, setAccount] = useState<Account | null>(() => (userId ? confirmed.get(userId) ?? null : null));
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
  // Checked only for the user Privy names (never the stand-in above), so one person's account is
  // never kept under another's id.
  const liveId = auth.userId;
  const reload = useCallback(async () => {
    if (!authenticated || !liveId) return;
    const userId = liveId;
    const round = ++generation.current;
    setProblem(null);
    for (let attempt = 1; ; attempt++) {
      try {
        const token = await tokenWithin(getAccessToken(), TOKEN_WAIT_MS);
        if (!token) throw new Error(STALLED);
        const [me, pin] = await Promise.all([engineGet<Me>('/v1/me', token, { timeoutMs: 15_000 }), pinStatus(async () => token)]);
        if (!mounted.current || generation.current !== round) return;
        const next = { owner: userId, handle: me.handle, configured: pin.configured };
        confirmed.set(userId, next);
        setAccount(next); setProblem(null);
        return;
      } catch (e) {
        if (!mounted.current || generation.current !== round) return;
        if (attempt >= TRIES) { setProblem(errorMessage(e)); return; }
        await new Promise((r) => setTimeout(r, 1_500));
      }
    }
  }, [authenticated, liveId, getAccessToken]);
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
  // The check is taking a while: a way out shows under the spinner instead of waiting it out.
  const checkingAccount = setup && !mine && !problem;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!checkingAccount) return;
    const timer = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(timer);
  }, [checkingAccount]);
  useEffect(() => {
    if (mine && userId) rememberPinReady(userId, mine.configured && !!mine.handle);
  }, [mine, userId]);
  return (
    <Context.Provider value={{ request, reload }}>
      {setup ? !mine ? (
        <View key={`account-check-${theme}`} testID="atlas-account-check" style={styles.loading}>
          {problem ? <><Text variant="heading">Securing your Atlas account</Text><Text color="danger">{problem}</Text><PillButton label="Try again" onPress={reload} /><PillButton label="Sign out" tone="secondary" onPress={logout} /></>
            : <><ActivityIndicator color={colors.accentPink} /><Text color="textSecondary">Securing your account…</Text>
              {slow ? <PillButton label="Sign out" tone="secondary" size="sm" onPress={logout} /> : null}</>}
        </View>
      ) : <PinSetup key={`pin-setup-${theme}`} handle={mine.handle} onDone={() => { setJustSetUp(true); void reload(); }} /> : (
        <AppLock active={authenticated} startLocked={!justSetUp} userId={userId} handle={mine?.handle ?? null}>{children}</AppLock>
      )}
      <Modal key={`payment-pin-${theme}`} visible={!!waiting} transparent animationType="slide" onRequestClose={cancel}>
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
