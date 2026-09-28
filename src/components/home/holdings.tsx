import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DisplayCurrency, Holding } from '@/api/contract';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatMoney, formatTokenAmount, HIDDEN } from '@/format/money';
import { colors, radii, spacing } from '@/theme';

type Props = {
  holdings: Holding[];
  currency: DisplayCurrency;
  showEmptyPockets: boolean;
  stealth: boolean;
};

const LOCATION_NOTE: Partial<Record<NonNullable<Holding['location']>, string>> = {
  gateway_pending: 'Arriving',
};

// Chevron under the balance card that opens the per-asset breakdown.
export function Holdings({ holdings, currency, showEmptyPockets, stealth }: Props) {
  const [open, setOpen] = useState(false);
  const visible = showEmptyPockets ? holdings : holdings.filter((h) => Number(h.amount) !== 0);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Hide breakdown' : 'Show breakdown'}
        hitSlop={8}
        style={styles.toggle}>
        <Text variant="label" color="textSecondary">
          {open ? 'Hide breakdown' : 'See breakdown'}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color="accentPink" />
      </Pressable>

      {open ? (
        <View style={styles.list}>
          {visible.length === 0 ? (
            <Text color="textSecondary" style={styles.empty}>
              Nothing here yet. Deposit to get started.
            </Text>
          ) : (
            visible.map((h) => (
              <Card key={`${h.assetId}:${h.chain}:${h.location ?? 'wallet'}`} level="alt" style={styles.item}>
                <View style={styles.icon}>
                  <Text variant="label" color="accentPinkTint" style={styles.iconText} numberOfLines={1}>
                    {h.symbol.slice(0, 4)}
                  </Text>
                </View>
                <View style={styles.itemText}>
                  <Text variant="bodyStrong">{stealth ? HIDDEN : formatTokenAmount(h.amount, h.symbol)}</Text>
                  <Text variant="caption" color="textSecondary">
                    {h.name}
                    {h.location && LOCATION_NOTE[h.location] ? ` · ${LOCATION_NOTE[h.location]}` : ''}
                  </Text>
                </View>
                <Text variant="bodyStrong">{stealth ? HIDDEN : formatMoney(h.value)}</Text>
              </Card>
            ))
          )}
          {currency !== 'USD' ? (
            <Text variant="caption" color="textSecondary" style={styles.disclaimer}>
              {currency} amounts are approximate.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  list: {
    gap: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 11,
  },
  itemText: {
    flex: 1,
    gap: spacing.xxs,
  },
  empty: {
    textAlign: 'center',
  },
  disclaimer: {
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
