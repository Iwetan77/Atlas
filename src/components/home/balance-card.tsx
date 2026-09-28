import { Pressable, StyleSheet, View } from 'react-native';

import type { BalanceResponse } from '@/api/contract';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { formatMoney, formatUsd, HIDDEN } from '@/format/money';
import { spacing } from '@/theme';

type Props = {
  balance: BalanceResponse | null;
  loading: boolean;
  error: string | null;
  stealth: boolean;
  onToggleStealth: () => void;
  onRetry: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
};

// The one number users care about, in their currency. Chains, bridges and buckets stay out of it.
export function BalanceCard({
  balance,
  loading,
  error,
  stealth,
  onToggleStealth,
  onRetry,
  onDeposit,
  onWithdraw,
}: Props) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="label" color="textSecondary">
          Balance
        </Text>
        <Pressable onPress={onToggleStealth} hitSlop={10} accessibilityRole="button">
          <Text variant="label" color="accentPinkTint">
            {stealth ? 'Show' : 'Hide'}
          </Text>
        </Pressable>
      </View>

      {balance ? (
        <>
          <Text variant="display" accessibilityLabel={stealth ? 'Balance hidden' : undefined}>
            {stealth ? HIDDEN : formatMoney(balance.total)}
          </Text>
          {balance.total.currency !== 'USD' ? (
            <Text color="textSecondary">{stealth ? HIDDEN : formatUsd(balance.totalUsd)}</Text>
          ) : null}
          {balance.pending ? (
            <Text variant="caption" color="accentPinkTint">
              {stealth ? HIDDEN : formatMoney(balance.pending)} arriving
            </Text>
          ) : null}
          {error ? (
            <Text variant="caption" color="textSecondary">
              Couldn&apos;t refresh just now. Showing your last balance.
            </Text>
          ) : null}
        </>
      ) : error && !loading ? (
        <View style={styles.unavailable}>
          <Text variant="heading" color="textSecondary">
            Balance unavailable
          </Text>
          <Pressable onPress={onRetry} hitSlop={8}>
            <Text variant="label" color="accentPinkTint">
              Try again
            </Text>
          </Pressable>
        </View>
      ) : (
        <Text variant="display" color="textDisabled">
          —
        </Text>
      )}

      <View style={styles.actions}>
        <PillButton label="Deposit" disabled={!onDeposit} onPress={onDeposit} style={styles.action} />
        <PillButton
          label="Withdraw"
          tone="secondary"
          disabled={!onWithdraw}
          onPress={onWithdraw}
          style={styles.action}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unavailable: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
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
