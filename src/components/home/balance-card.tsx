import { Pressable, StyleSheet, View } from 'react-native';

import type { BalanceResponse } from '@/api/contract';
import { GlowCard } from '@/components/ui/glow-card';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { formatMoney, formatUsd, HIDDEN } from '@/format/money';
import { colors, radii, spacing } from '@/theme';

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
    <GlowCard style={styles.card}>
      <View style={styles.header}>
        <Text variant="overline" color="textSecondary">
          Total balance
        </Text>
        <Pressable
          onPress={onToggleStealth}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={stealth ? 'Show balance' : 'Hide balance'}>
          <Icon name={stealth ? 'eye-off-outline' : 'eye-outline'} size={20} color="textSecondary" />
        </Pressable>
      </View>

      {balance ? (
        <View style={styles.figures}>
          <Text variant="display" adjustsFontSizeToFit numberOfLines={1}>
            {stealth ? HIDDEN : formatMoney(balance.total)}
          </Text>
          {balance.total.currency !== 'USD' ? (
            <Text color="textSecondary">≈ {stealth ? HIDDEN : formatUsd(balance.totalUsd)}</Text>
          ) : null}
          {balance.pending ? (
            <View style={styles.pending}>
              <Icon name="time-outline" size={14} color="accentPinkTint" />
              <Text variant="label" color="accentPinkTint">
                {stealth ? HIDDEN : formatMoney(balance.pending)} arriving
              </Text>
            </View>
          ) : null}
          {error ? (
            <Text variant="caption" color="textSecondary">
              Couldn&apos;t refresh just now. Showing your last balance.
            </Text>
          ) : null}
        </View>
      ) : error && !loading ? (
        <View style={styles.figures}>
          <Text variant="title" color="textSecondary">
            Balance unavailable
          </Text>
          <Pressable onPress={onRetry} hitSlop={8} style={styles.retry}>
            <Icon name="refresh" size={14} color="accentPinkTint" />
            <Text variant="label" color="accentPinkTint">
              Try again
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.figures}>
          <View style={styles.skeleton} />
          <View style={[styles.skeleton, styles.skeletonSmall]} />
        </View>
      )}

      <View style={styles.actions}>
        <PillButton label="Deposit" icon="arrow-down" disabled={!onDeposit} onPress={onDeposit} style={styles.action} />
        <PillButton
          label="Withdraw"
          icon="arrow-up"
          tone="secondary"
          disabled={!onWithdraw}
          onPress={onWithdraw}
          style={styles.action}
        />
      </View>
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  figures: {
    gap: spacing.xs,
    minHeight: 84,
    justifyContent: 'center',
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingVertical: spacing.xxs + 1,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDim,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  skeleton: {
    height: 40,
    width: '70%',
    borderRadius: radii.sm,
    backgroundColor: colors.bgSurfaceAlt,
  },
  skeletonSmall: {
    height: 16,
    width: '35%',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
