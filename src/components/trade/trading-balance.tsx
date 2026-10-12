import { Pressable, View } from 'react-native';

import { useBalance } from '@/api/balance';
import { pocketMoney, pocketsLive, tradingAmount } from '@/api/pockets';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatMoney, hiddenMoney } from '@/format/money';
import { openMove } from '@/funding/move-money';
import { useSettings } from '@/settings/context';
import { colors, radii, spacing, themedStyles } from '@/theme';

// At the top of Trade and Perps: what there is to trade with, on the hero card's pink, with Add
// (from Spendable) and, once there's something in it, the way back to Spendable.
export function TradingBalanceCard() {
  const { data } = useBalance();
  const { stealthMode } = useSettings();
  // Nothing to show until the engine keeps Trading apart (it can't move money in before then).
  if (data && !pocketsLive(data)) return null;
  const trading = data ? tradingAmount(data) : null;
  const amount =
    data && trading !== null
      ? stealthMode
        ? hiddenMoney(data.total.currency)
        : formatMoney(pocketMoney(data, trading))
      : null;
  return (
    <View style={styles.card}>
      <View style={styles.wash} />
      <View style={styles.text}>
        <Text variant="caption" color="textOnAccent" style={styles.soft}>
          Trading balance
        </Text>
        {amount !== null ? (
          <Text variant="title" color="textOnAccent" numberOfLines={1} adjustsFontSizeToFit>
            {amount}
          </Text>
        ) : (
          <View style={styles.skeleton} />
        )}
        {trading !== null && trading >= 0.01 ? (
          <Pressable
            onPress={() => openMove('to_spendable')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Move to spendable"
            style={styles.back}>
            <Text variant="caption" color="textOnAccent">
              Move to spendable
            </Text>
            <Icon name="chevron-forward" size={12} color="textOnAccent" />
          </Pressable>
        ) : (
          <Text variant="caption" color="textOnAccent" style={styles.soft}>
            Add money from Spendable to start trading
          </Text>
        )}
      </View>
      <Pressable
        onPress={() => openMove('to_trading')}
        accessibilityRole="button"
        accessibilityLabel="Add money to your trading balance"
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
        <View style={styles.addIcon}>
          <Icon name="add" size={18} color="accentPinkDeep" />
        </View>
        <Text variant="bodyStrong" color="textOnAccent">
          Add
        </Text>
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    paddingLeft: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.accentPink,
    overflow: 'hidden',
  },
  // The hero card's decorative circle.
  wash: {
    position: 'absolute',
    right: -50,
    top: -60,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.accentPinkWash,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  soft: {
    opacity: 0.85,
  },
  skeleton: {
    height: 28,
    width: '60%',
    borderRadius: radii.sm,
    backgroundColor: colors.onAccentSoft,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    marginTop: spacing.xxs,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.onAccentSoft,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDeep,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  addIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
  },
}));
