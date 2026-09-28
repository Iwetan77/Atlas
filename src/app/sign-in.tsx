import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAtlasAuth } from '@/auth/context';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';

export default function SignInScreen() {
  const { loginWithGoogle, googleLoading, googleError } = useAtlasAuth();

  return (
    <Screen scroll={false} style={styles.screen}>
      <View style={styles.hero}>
        <Text variant="display" color="accentPink">
          Atlas
        </Text>
        <Text variant="heading">One balance. Spend it on anything.</Text>
        <Text color="textSecondary">
          Fund it in naira, buy stocks, memes and more, and cash out to your bank.
        </Text>
      </View>

      <View style={styles.actions}>
        <PillButton label="Continue with Google" loading={googleLoading} onPress={loginWithGoogle} />
        <PillButton label="Continue with email" tone="secondary" onPress={() => router.push('/sign-in-email')} />
        {googleError ? <Text color="danger">{googleError}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
});
