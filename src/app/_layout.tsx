import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { DarkTheme, type ErrorBoundaryProps, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { useAtlasAuth } from '@/auth/context';
import { AtlasAuthProvider } from '@/auth/provider';
import { StartupError, StartupStatus } from '@/components/startup-status';
import { AddMoneyProvider } from '@/funding/add-money';
import { WithdrawProvider } from '@/funding/withdraw';
import { SettingsProvider } from '@/settings/context';
import { PinProvider } from '@/security/pin-provider';
import { ConfirmProvider } from '@/signing/confirm';
import { colors } from '@/theme';
import { WebShell } from '@/components/web/shell';
import { useKeyboardScroll } from '@/web/use-keyboard-scroll';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accentPink,
    background: colors.bgBase,
    card: colors.bgSurface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.accentPink,
  },
};

// Any render crash lands here with its message instead of a blank or red screen.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <StartupError error={error} retry={retry} />;
}

const noHydrationEvents = () => () => {};
const browserMounted = () => true;
const serverMounted = () => false;

export default function RootLayout() {
  useKeyboardScroll();
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
      <StatusBar style="light" />
      <SettingsProvider>
        <AtlasAuthProvider>
          <PinProvider>
          <ConfirmProvider>
            <AddMoneyProvider>
              <WithdrawProvider>
                <WebShell><RootStack /></WebShell>
              </WithdrawProvider>
            </AddMoneyProvider>
          </ConfirmProvider>
          </PinProvider>
        </AtlasAuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { ready, authenticated, initError } = useAtlasAuth();
  // Once started, the navigator stays mounted and sign-in only changes while Privy is settled. A
  // passing blip (Privy re-checking the session, a network error) that tore it down or flipped the
  // guard would land the user back on Home mid-task.
  const [started, setStarted] = useState(false);
  const [signedIn, setSignedIn] = useState(authenticated);
  if (ready && !initError && !started) setStarted(true);
  if (ready && !initError && authenticated !== signedIn) setSignedIn(authenticated);

  // Public web pages and install instructions stay available while sign-in starts.
  if (!started && Platform.OS !== 'web') return <StartupStatus error={initError} />;

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
