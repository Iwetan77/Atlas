import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAtlasAuth } from '@/auth/context';
import { NextSteps } from '@/components/next-steps';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { showDevTools } from '@/config';
import { spacing } from '@/theme';

// Balance data is wired to the engine in Phase 2; until then the card shows no figure rather than a fake one.
export default function HomeScreen() {
  const { phone } = useAtlasAuth();

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Atlas</Text>
        {showDevTools ? (
          <Pressable onPress={() => router.push('/dev')} hitSlop={8}>
            <Text variant="label" color="accentPinkTint">
              Dev
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Card style={styles.balanceCard}>
        <Text variant="label" color="textSecondary">
          Your balance
        </Text>
        <Text variant="display" color="textDisabled">
          —
        </Text>
        <View style={styles.actions}>
          <PillButton label="Deposit" disabled style={styles.action} />
          <PillButton label="Withdraw" tone="secondary" disabled style={styles.action} />
        </View>
      </Card>

      <NextSteps
        steps={[
          {
            key: 'phone',
            title: 'Connect phone number',
            subtitle: 'Receive from anyone',
            done: !!phone,
            onPress: () => router.push('/connect-phone'),
          },
          {
            key: 'deposit',
            title: 'Make a deposit',
            subtitle: 'Add money in naira or crypto',
            done: false,
          },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceCard: {
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  action: {
    flex: 1,
  },
});
