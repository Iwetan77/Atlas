import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';

// Phase 0 shell: layout and theme only. Balance data is wired to the engine in Phase 2.
export default function HomeScreen() {
  return (
    <Screen>
      <Text variant="title">Atlas</Text>

      <Card style={styles.balanceCard}>
        <Text variant="label" color="textSecondary">
          Your balance
        </Text>
        <Text variant="display" color="textDisabled">
          —
        </Text>
        <View style={styles.actions}>
          <PillButton label="Deposit" disabled />
          <PillButton label="Withdraw" tone="secondary" disabled />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
