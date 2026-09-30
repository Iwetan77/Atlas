import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { DarkTheme, type ErrorBoundaryProps, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useAtlasAuth } from '@/auth/context';
import { AtlasAuthProvider } from '@/auth/provider';
import { StartupError, StartupStatus } from '@/components/startup-status';
import { AddMoneyProvider } from '@/funding/add-money';
import { showDevTools } from '@/config';
import { SettingsProvider } from '@/settings/context';
import { ConfirmProvider } from '@/signing/confirm';
import { colors } from '@/theme';

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

export default function RootLayout() {
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
  if (!fontsSettled) return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <SettingsProvider>
        <AtlasAuthProvider>
          <ConfirmProvider>
            <AddMoneyProvider>
              <RootStack />
            </AddMoneyProvider>
          </ConfirmProvider>
        </AtlasAuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { ready, authenticated, initError } = useAtlasAuth();

  if (!ready || initError) return <StartupStatus error={initError} />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBase } }}>
      <Stack.Protected guard={authenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="deposit" />
        <Stack.Screen name="earn" />
        <Stack.Screen name="mini/[appId]" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="trade/[assetId]" />
        <Stack.Screen name="perps/[marketId]" />
        <Stack.Screen name="perps/close/[positionId]" />
        <Stack.Screen name="send/friend" />
        <Stack.Screen name="send/bank" />
        <Stack.Screen name="send/link" />
        <Stack.Screen name="handle" />
        <Stack.Protected guard={showDevTools}>
          <Stack.Screen name="dev" />
          <Stack.Screen name="dev-home-preview" />
        </Stack.Protected>
      </Stack.Protected>
      <Stack.Protected guard={!authenticated}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-in-email" />
      </Stack.Protected>
      {/* Public: someone without Atlas opens an Atlas link here and signs in on the page. Last, because
          the router falls back to the first screen it may show: signed out, that must be sign-in. */}
      <Stack.Screen name="claim/[linkId]" />
    </Stack>
  );
}
