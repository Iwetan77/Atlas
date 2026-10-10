import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { unlockWithPin } from '@/api/pin';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { startedWithSession } from '@/auth/device-session';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import {
  biometricsAsked, biometricsOn, biometry, enableBiometrics, markBiometricsAsked, unlockWithBiometrics, type Biometry,
} from '@/security/biometrics';
import { PinPad } from '@/security/pin-pad';
import { colors, radii, spacing, themedStyles } from '@/theme';

// Away this long and Atlas asks again; a quick trip (copying an address, a share sheet) doesn't.
// A desktop browser tab gets longer: people switch tabs all day.
const LOCK_AFTER_MS = 60_000;
const DESKTOP_LOCK_AFTER_MS = 10 * 60_000;

function lockAfter(): number {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return LOCK_AFTER_MS;
  return window.matchMedia?.('(pointer: fine)').matches ? DESKTOP_LOCK_AFTER_MS : LOCK_AFTER_MS;
}

// Opening Atlas asks for the PIN (or Face ID / fingerprint once turned on): at every start with a
// saved session, and on coming back after a while. Protected screens mount after verification.
export function AppLock({ active, startLocked = true, userId, handle, children }: {
  active: boolean; startLocked?: boolean; userId: string | null; handle: string | null; children: ReactNode;
}) {
  // Google/email restores identity; a configured Atlas account still needs its server-verified PIN.
  const [locked, setLocked] = useState(startLocked);
  const [requirePin, setRequirePin] = useState(() => startLocked && !startedWithSession());
  useEffect(() => {
    let awayAt: number | null = null;
    const away = () => { awayAt ??= Date.now(); };
    const back = () => {
      if (awayAt !== null && Date.now() - awayAt >= lockAfter()) setLocked(true);
      awayAt = null;
    };
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const change = () => (document.visibilityState === 'hidden' ? away() : back());
      document.addEventListener('visibilitychange', change);
      return () => document.removeEventListener('visibilitychange', change);
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') away();
      else if (state === 'active') back();
    });
    return () => subscription.remove();
  }, []);
  const unlock = useCallback(() => { setRequirePin(false); setLocked(false); }, []);
  return (
    <>
      {active && locked && userId
        ? <LockScreen userId={userId} handle={handle} requirePin={requirePin} onUnlock={unlock} />
        : children}
    </>
  );
}

function LockScreen({ userId, handle, requirePin, onUnlock }: { userId: string; handle: string | null; requirePin: boolean; onUnlock: () => void }) {
  const { getAccessToken, logout } = useAtlasAuth();
  const insets = useSafeAreaInsets();
  const [bio, setBio] = useState<Biometry | null>(null);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  // After the PIN: offer Face ID / fingerprint once, if the device has it.
  const [offer, setOffer] = useState<Biometry | null>(null);
  const on = !requirePin && biometricsOn(userId);
  const prompted = useRef(false);

  const tryBiometrics = useCallback(async () => {
    if (!requirePin && await unlockWithBiometrics(userId)) onUnlock();
  }, [userId, requirePin, onUnlock]);

  useEffect(() => {
    let live = true;
    void biometry().then((b) => { if (live) setBio(b); });
    // On a phone app, straight to Face ID / fingerprint when it's on; the PIN pad stays underneath for
    // when it fails. In a browser (the iPhone Home Screen app) the passkey prompt only works after a
    // tap: asked by itself, iOS flashed its password sheet and closed it. There it waits for the
    // "Use Face ID" button.
    if (on && Platform.OS !== 'web' && !prompted.current) {
      prompted.current = true;
      void tryBiometrics();
    }
    return () => { live = false; };
  }, [on, tryBiometrics]);

  const verify = async (pin: string) => {
    if (checking) return;
    setChecking(true);
    setProblem(null);
    try {
      const result = await unlockWithPin(getAccessToken, pin);
      if (result.unlocked !== true) throw new Error('Your PIN could not be verified. Try again.');
      const b = bio ?? await biometry();
      if (b.available && !biometricsOn(userId) && !biometricsAsked(userId)) setOffer(b);
      else onUnlock();
    } catch (e) {
      setProblem(errorMessage(e));
      setReset((n) => n + 1);
    } finally {
      setChecking(false);
    }
  };

  const turnOn = async () => {
    if (!offer || checking) return;
    setChecking(true);
    await enableBiometrics(userId, offer.label);
    onUnlock();
  };

  return (
    // The Android back button can't dismiss it.
    <Modal visible animationType="none" onRequestClose={() => {}} statusBarTranslucent>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.wrap}>
            <View style={styles.wordmark}>
              <Image source={require('../../assets/images/icon.png')} style={styles.logo} accessibilityLabel="Atlas" />
              <Text variant="title" style={styles.atlas}>atlas<Text variant="title" color="accentPink">.</Text></Text>
            </View>
            {offer ? (
              <View style={styles.card}>
                <View style={styles.brand}><Icon name={offer.icon} size={30} color="accentPinkTint" /></View>
                <Text variant="title" style={styles.title}>{`Open Atlas with ${offer.label}?`}</Text>
                <Text color="textSecondary" style={styles.description}>
                  {`Next time, ${offer.label} opens Atlas. Your PIN still approves payments, and it always works too.`}
                </Text>
                <PillButton label={`Use ${offer.label}`} icon={offer.icon} loading={checking} onPress={turnOn} style={styles.button} />
                <PillButton label="Not now" tone="secondary" disabled={checking} style={styles.button}
                  onPress={() => { markBiometricsAsked(userId); onUnlock(); }} />
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.intro}>
                  <Text variant="title" style={styles.title}>{handle ? `Welcome back, @${handle}` : 'Welcome back'}</Text>
                  <Text color="textSecondary" style={styles.description}>Enter your PIN to open Atlas.</Text>
                </View>
                <PinPad label="Atlas PIN" resetKey={reset} disabled={checking} onComplete={verify} />
                {checking ? <ActivityIndicator color={colors.accentPink} /> : null}
                {problem ? <Text color="danger" style={styles.center} accessibilityRole="alert">{problem}</Text> : null}
                {on && bio ? (
                  <PillButton label={`Use ${bio.label}`} icon={bio.icon} tone="secondary" disabled={checking} onPress={tryBiometrics} style={styles.button} />
                ) : null}
                <Pressable style={styles.link} disabled={checking} onPress={logout} accessibilityRole="button">
                  <Text variant="label" color="textSecondary">Not you? Sign out</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  wrap: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: spacing.xxl, alignItems: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 40, height: 40, borderRadius: radii.sm },
  atlas: { fontSize: 28, lineHeight: 34 },
  card: { width: '100%', gap: 20, alignItems: 'center' },
  intro: { alignItems: 'center', gap: spacing.sm },
  brand: { width: 56, height: 56, borderRadius: 20, backgroundColor: colors.accentPinkMuted,
    alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center', fontSize: 26, lineHeight: 32 },
  description: { textAlign: 'center', maxWidth: 310 },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch' },
  link: { alignSelf: 'center', minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center' },
}));
