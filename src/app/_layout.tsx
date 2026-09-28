import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAtlasAuth } from '@/auth/context';
import { AtlasAuthProvider } from '@/auth/provider';
import { showDevTools } from '@/config';
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

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <AtlasAuthProvider>
        <RootStack />
      </AtlasAuthProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { ready, authenticated } = useAtlasAuth();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accentPink} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBase } }}>
      <Stack.Protected guard={authenticated}>
        <Stack.Screen name="index" />
        <Stack.Screen name="connect-phone" options={{ presentation: 'modal' }} />
        <Stack.Protected guard={showDevTools}>
          <Stack.Screen name="dev" />
        </Stack.Protected>
      </Stack.Protected>
      <Stack.Protected guard={!authenticated}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-in-phone" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgBase,
  },
});
