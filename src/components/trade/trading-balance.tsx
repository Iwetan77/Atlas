import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { useBalance } from '@/api/balance';
import { pocketMoney, pocketsLive, tradingAmount } from '@/api/pockets';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatCompactMoney, formatMoney, hiddenMoney } from '@/format/money';
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

// The widest the pinned balance gets, so the search keeps most of the row.
const PILL_MAX = 132;

// Once the card above has scrolled away, the trading balance stays in sight beside the pinned search:
// small, in the card's pink, with + to add money. It slides in as the search makes room for it.
export function TradingBalancePill() {
  const { data } = useBalance();
  const { stealthMode } = useSettings();
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [shown]);
  if (!data || !pocketsLive(data)) return null;
  const money = pocketMoney(data, tradingAmount(data));
  // Bigger balances read short here ("₦53.14K"); the card above has the exact figure.
  const amount = stealthMode
    ? hiddenMoney(data.total.currency)
    : Number(money.amount) >= 10_000
      ? formatCompactMoney(money)
      : formatMoney(money);
  return (
    <Animated.View
      style={{
        maxWidth: shown.interpolate({ inputRange: [0, 1], outputRange: [0, PILL_MAX] }),
        marginLeft: shown.interpolate({ inputRange: [0, 1], outputRange: [0, spacing.sm] }),
        opacity: shown,
        overflow: 'hidden',
      }}>
      <Pressable
        onPress={() => openMove('to_trading')}
        accessibilityRole="button"
        accessibilityLabel={`Trading balance ${amount}. Add money`}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
        <Text variant="label" color="textOnAccent" numberOfLines={1} style={styles.pillAmount}>
          {amount}
        </Text>
        <View style={styles.pillAdd}>
          <Icon name="add" size={14} color="accentPinkDeep" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = themedStyles(() => ({
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.accentPink,
  },
  pillAmount: {
    flexShrink: 1,
    fontSize: 14,
  },
  pillAdd: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
  },
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
