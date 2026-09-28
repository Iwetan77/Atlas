import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAtlasAuth } from '@/auth/context';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { network } from '@/config';
import { spacing } from '@/theme';

// Testnet-only screen for verifying Phase 1: who is signed in and which wallets they got.
export default function DevScreen() {
  const auth = useAtlasAuth();

  const rows: [string, string | null][] = [
    ['Network', network],
    ['Privy user', auth.userId],
    ['Email', auth.email],
    ['Phone', auth.phone],
    ['Solana wallet', auth.wallets.solana],
    ['Base wallet', auth.wallets.base],
  ];

  return (
    <Screen>
      <BackHeader title="Developer" />
      <Card level="alt" style={styles.card}>
        {rows.map(([label, value]) => (
          <Pressable
            key={label}
            disabled={!value}
            onPress={() => value && Clipboard.setStringAsync(value)}
            style={styles.row}>
            <Text variant="caption" color="textSecondary">
              {label}
            </Text>
            <Text selectable variant="bodyStrong" color={value ? 'textPrimary' : 'textDisabled'}>
              {value ?? (label.endsWith('wallet') ? 'creating…' : '—')}
            </Text>
          </Pressable>
        ))}
      </Card>
      <Text variant="caption" color="textSecondary">
        Tap a row to copy it.
      </Text>
      <View style={styles.signOut}>
        <PillButton label="Sign out" tone="secondary" onPress={auth.logout} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  row: {
    gap: spacing.xxs,
  },
  signOut: {
    marginTop: spacing.lg,
  },
});
