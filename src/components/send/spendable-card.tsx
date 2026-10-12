import { Pressable, View } from 'react-native';

import { useBalance } from '@/api/balance';
import { spendableAmount, tradingAmount } from '@/api/pockets';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatMoney, hiddenMoney } from '@/format/money';
import { openMove } from '@/funding/move-money';
import { useSettings } from '@/settings/context';
import { colors, radii, spacing, themedStyles } from '@/theme';

// On Send and Withdraw: what can be sent (Spendable), next to the whole balance, on the hero card's
// Atlas pink. Money in Trading can be moved back here in a few seconds.
export function SpendableCard() {
  const { data } = useBalance();
  const { stealthMode } = useSettings();
  if (!data) return null;
  const currency = data.total.currency;
  const spendable = spendableAmount(data);
  const trading = tradingAmount(data);
  const total = Number(data.total.amount);
  const show = (amount: number) => (stealthMode ? hiddenMoney(currency) : formatMoney({ amount: amount.toFixed(2), currency }));
  const locked = total - spendable - trading > 0.01;
  return (
    <View style={styles.card} accessibilityLabel={'Spendable now ' + show(spendable)}>
      <View style={styles.wash} />
      <View style={styles.header}>
        <View style={styles.icon}>
          <Icon name="wallet-outline" size={18} color="accentPinkDeep" />
        </View>
        <Text variant="bodyStrong" color="textOnAccent">Spendable now</Text>
      </View>
      <Text variant="title" color="textOnAccent" style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
        {show(spendable)}
      </Text>
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text variant="caption" color="textOnAccent" style={styles.soft}>Your total balance</Text>
          <Text variant="label" color="textOnAccent">{show(total)}</Text>
        </View>
        {trading >= 0.01 ? (
          <Pressable
            onPress={() => openMove('to_spendable')}
            accessibilityRole="button"
            accessibilityLabel={'Move from trading, ' + show(trading) + ' there'}
            style={({ pressed }) => [styles.move, pressed && styles.pressed]}>
            <Icon name="swap-horizontal" size={16} color="textOnAccent" />
            <Text variant="label" color="textOnAccent" style={styles.moveText}>
              {show(trading)} in Trading
            </Text>
            <Text variant="label" color="textOnAccent">Move here</Text>
            <Icon name="chevron-forward" size={14} color="textOnAccent" />
          </Pressable>
        ) : null}
        {locked ? (
          <Text variant="caption" color="textOnAccent" style={styles.soft}>
            The rest is in your coins, savings or perps. Sell or withdraw them when you need more cash.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  card: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: 28,
    backgroundColor: colors.accentPink,
    overflow: 'hidden',
  },
  // The hero card's decorative circle.
  wash: {
    position: 'absolute',
    right: -70,
    top: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.accentPinkWash,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
  },
  amount: {
    fontSize: 34,
    lineHeight: 42,
  },
  soft: {
    opacity: 0.85,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.onAccentSoft,
  },
  move: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDeep,
  },
  pressed: {
    opacity: 0.85,
  },
  moveText: {
    flex: 1,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
}));
