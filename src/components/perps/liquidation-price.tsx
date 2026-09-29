import { StyleSheet, View } from 'react-native';

import type { Money } from '@/api/contract';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatExactMoney } from '@/format/money';
import { colors, radii, spacing } from '@/theme';

// The number that matters most on a leveraged position, shown big and exactly as the engine
// reported it (never recomputed or rounded here), with one plain line on what it means.
export function LiquidationPrice({
  price,
  side,
  symbol,
  compact,
}: {
  price: Money;
  side: 'long' | 'short';
  symbol: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.band, compact && styles.compact]} accessibilityLabel={`Liquidation price ${formatExactMoney(price)}`}>
      <View style={styles.label}>
        <Icon name="warning-outline" size={16} color="danger" />
        <Text variant="label" color="danger">
          Liquidation price
        </Text>
      </View>
      <Text variant={compact ? 'heading' : 'title'} selectable>
        {formatExactMoney(price)}
      </Text>
      {compact ? null : (
        <Text variant="caption" color="textSecondary">
          If {symbol} {side === 'long' ? 'falls to' : 'rises to'} this price, the position closes and the margin is lost.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerDim,
  },
  compact: {
    padding: spacing.md,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
