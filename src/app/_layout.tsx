import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, type ErrorBoundaryProps, router, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';

import { useAtlasAuth } from '@/auth/context';
import { markWelcomeShown, rememberSignedIn, startedWithSession, takeSigningOut } from '@/auth/device-session';
import { AtlasAuthProvider } from '@/auth/provider';
import { StartupError, StartupStatus } from '@/components/startup-status';
import { AddMoneyProvider } from '@/funding/add-money';
import { WithdrawProvider } from '@/funding/withdraw';
import { SettingsProvider } from '@/settings/context';
import { PinProvider } from '@/security/pin-provider';
import { ConfirmProvider } from '@/signing/confirm';
import { colors, subscribeTheme, themeName, type ThemeName } from '@/theme';
import { WebShell } from '@/components/web/shell';
import { useKeyboardScroll } from '@/web/use-keyboard-scroll';

SplashScreen.preventAutoHideAsync();

function navThemeFor(theme: ThemeName) {
  const base = theme === 'light' ? DefaultTheme : DarkTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accentPink,
      background: colors.bgBase,
      card: colors.bgSurface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.accentPink,
    },
  };
}

// Any render crash lands here with its message instead of a blank or red screen.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <StartupError error={error} retry={retry} />;
}

const noHydrationEvents = () => () => {};
const browserMounted = () => true;
const serverMounted = () => false;

export default function RootLayout() {
  useKeyboardScroll();
  const theme = useSyncExternalStore(subscribeTheme, themeName, themeName);
  const navTheme = useMemo(() => navThemeFor(theme), [theme]);
  // Native pieces (keyboard, alerts, the window behind the app) follow the theme too.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme?.(theme);
    SystemUI.setBackgroundColorAsync(colors.bgBase).catch(() => {});
  }, [theme]);
  // Screens keep what they drew until something changes on them, so a switch redraws the app from
  // scratch and brings the user back to Profile, where the switch is.
  const first = useRef(theme);
  useEffect(() => {
    if (theme === first.current) return;
    first.current = theme;
    setTimeout(() => router.navigate('/profile'), 0);
  }, [theme]);
  // Privy's browser session/wallet tree mounts after hydration, never against a server snapshot.
  const hydrated = useSyncExternalStore(noHydrationEvents, browserMounted, serverMounted);
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const fontsSettled = fontsLoaded || !!fontError;

  // The native splash only waits for fonts. Sign-in start-up shows its own status screen, so a
  // stalled SDK can never hide behind the splash.
  useEffect(() => {
    if (fontsSettled) SplashScreen.hideAsync();
  }, [fontsSettled]);

  // A font that fails to load falls back to the system face.
  if (Platform.OS === 'web' && !hydrated) return null;

  // Web font preloads/style rules can paint while the runtime cache settles.
  if (!fontsSettled && Platform.OS !== 'web') return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <SettingsProvider>
        <AtlasAuthProvider>
          <PinProvider>
          <ConfirmProvider>
            <AddMoneyProvider>
              <WithdrawProvider>
                <WebShell key={theme}><RootStack /></WebShell>
              </WithdrawProvider>
            </AddMoneyProvider>
          </ConfirmProvider>
          </PinProvider>
        </AtlasAuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

// How long a device that was signed in waits for its saved session before showing the welcome
// screen, and how long a signed-in session may blip (Privy re-checking it, a network error) before
// it counts as signed out.
const RESTORE_MS = 5_000;
const BLIP_MS = 3_000;

function RootStack() {
  const { ready, authenticated, initError } = useAtlasAuth();
  const pathname = usePathname();
  // Once started, the navigator stays mounted and sign-in only changes while Privy is settled. A
  // passing blip that tore it down or flipped the guard would land the user back on the welcome
  // screen mid-task, so only a lasting sign-out (or tapping Sign out) does.
  const [started, setStarted] = useState(false);
  const [signedIn, setSignedIn] = useState(authenticated);
  const [waited, setWaited] = useState(!startedWithSession());
  if (ready && !initError && !started) setStarted(true);
  if (ready && !initError && authenticated && !signedIn) setSignedIn(true);
  useEffect(() => {
    if (waited) return;
    const id = setTimeout(() => setWaited(true), RESTORE_MS);
    return () => clearTimeout(id);
  }, [waited]);
  useEffect(() => {
    if (!ready || initError) return;
    if (authenticated) {
      rememberSignedIn(true);
      return;
    }
    if (!signedIn) return;
    const id = setTimeout(() => {
      rememberSignedIn(false);
      setSignedIn(false);
    }, takeSigningOut() ? 0 : BLIP_MS);
    return () => clearTimeout(id);
  }, [ready, initError, authenticated, signedIn]);

  // Someone who was signed in sees the Atlas logo until their session is back (then the lock),
  // never the welcome screen. A first visit to the website shows the welcome page at once, and the
  // public pages (install instructions, Atlas Links) never wait on sign-in.
  const publicPage = Platform.OS === 'web' && /^\/(install|claim)(\/|$)/.test(pathname);
  const restoring = started ? !authenticated && !signedIn && !waited : Platform.OS !== 'web' || startedWithSession();
  const showStack = publicPage || !restoring;
  useEffect(() => {
    if (showStack && !signedIn && !publicPage) markWelcomeShown();
  }, [showStack, signedIn, publicPage]);
  if (!showStack) return <StartupStatus error={initError} />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBase } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="deposit" />
        <Stack.Screen name="add-bank" />
        <Stack.Screen name="browse" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="earn" />
        <Stack.Screen name="predictions" />
        <Stack.Screen name="predictions/[marketId]" />
        <Stack.Screen name="predictions/cash" />
        <Stack.Screen name="transactions" />
        <Stack.Screen name="transaction/[id]" />
        <Stack.Screen name="mini/[appId]" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="trade/[assetId]" />
        <Stack.Screen name="perps/[marketId]" />
        <Stack.Screen name="perps/close/[positionId]" />
        <Stack.Screen name="send/friend" />
        <Stack.Screen name="send/bank" />
        <Stack.Screen name="send/link" />
        <Stack.Screen name="send/wallet" />
        <Stack.Screen name="handle" />
        <Stack.Screen name="payment-pin" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-in-email" />
      </Stack.Protected>
      {/* Public: someone without Atlas opens an Atlas link here and signs in on the page. Last, because
          the router falls back to the first screen it may show: signed out, that must be sign-in. */}
      <Stack.Screen name="claim/[linkId]" />
      <Stack.Screen name="install" />
    </Stack>
  );
}
