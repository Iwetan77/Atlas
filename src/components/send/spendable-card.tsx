import { StyleSheet, View } from 'react-native';

import { useBalance } from '@/api/balance';
import type { BalanceResponse } from '@/api/contract';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatMoney, hiddenMoney } from '@/format/money';
import { useSettings } from '@/settings/context';
import { colors, radii, spacing } from '@/theme';

// Cash that can leave right now: USDC in the Base and Solana wallets. Coins, savings, perps margin
// and Arc cash count in the balance but have to be sold or moved back first.
export function spendableAmount(balance: BalanceResponse): number {
  return balance.holdings
    .filter((h) => h.kind === 'cash' && (h.location ?? 'wallet') === 'wallet' && (h.chain === 'base' || h.chain === 'solana'))
    .reduce((sum, h) => sum + Number(h.value.amount), 0);
}

// On Send and Withdraw: what can be sent, next to the whole balance.
export function SpendableCard() {
  const { data } = useBalance();
  const { stealthMode } = useSettings();
  if (!data) return null;
  const currency = data.total.currency;
  const spendable = spendableAmount(data);
  const total = Number(data.total.amount);
  const show = (amount: number) => (stealthMode ? hiddenMoney(currency) : formatMoney({ amount: amount.toFixed(2), currency }));
  const locked = total - spendable > 0.01;
  return (
    <View style={styles.card} accessibilityLabel={'Spendable now ' + show(spendable)}>
      <View style={styles.header}>
        <View style={styles.labelGroup}>
          <View style={styles.icon}>
            <Icon name="wallet-outline" size={18} color="accentPinkTint" />
          </View>
          <Text variant="label" color="textSecondary">Spendable now</Text>
        </View>
        <View style={styles.ready}>
          <View style={styles.readyDot} />
          <Text variant="overline" color="accentPinkTint">Ready to send</Text>
        </View>
      </View>
      <Text variant="title" style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
        {show(spendable)}
      </Text>
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text variant="caption" color="textSecondary">Your total balance</Text>
          <Text variant="label">{show(total)}</Text>
        </View>
        {locked ? (
          <Text variant="caption" color="textSecondary">
            The rest is in your coins, savings or perps. Sell or withdraw them when you need more cash.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.bgTabBar,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPinkMuted,
  },
  ready: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkMuted,
  },
  readyDot: {
    width: 4,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkTint,
  },
  amount: {
    fontSize: 34,
    lineHeight: 42,
    color: colors.textPrimary,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
