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
  // Null before opening (the venue can't say yet), or on an open position with no liquidation price
  // (low leverage): shown as such, never estimated.
  price: Money | null;
  side: 'long' | 'short';
  symbol: string;
  compact?: boolean;
}) {
  return (
    <View
      style={[styles.band, compact && styles.compact]}
      accessibilityLabel={
        price ? `Liquidation price ${formatExactMoney(price)}` : compact ? 'No liquidation price' : 'Liquidation price available after opening'
      }>
      <View style={styles.label}>
        <Icon name="warning-outline" size={16} color="danger" />
        <Text variant="label" color="danger">
          Liquidation price
        </Text>
      </View>
      {price ? (
        <Text variant={compact ? 'heading' : 'title'} selectable>
          {formatExactMoney(price)}
        </Text>
      ) : (
        <Text variant={compact ? 'bodyStrong' : 'heading'}>{compact ? 'None at this leverage' : 'Available after opening'}</Text>
      )}
      {compact ? null : (
        <Text variant="caption" color="textSecondary">
          {price
            ? `If ${symbol} ${side === 'long' ? 'falls to' : 'rises to'} this price, the position closes and the margin is lost.`
            : `The exchange sets it once the position is open. You'll see it on your position straight away.`}
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
