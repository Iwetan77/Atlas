import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { DisplayCurrency } from '@/api/contract';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { currencySymbol, formatMoney, groupDigits } from '@/format/money';
import { colors, radii, spacing, type as typeScale } from '@/theme';

// Quick picks per display currency, roughly the same spend everywhere.
const QUICK: Record<DisplayCurrency, number[]> = {
  NGN: [5_000, 10_000, 50_000],
  USD: [5, 10, 50],
  EUR: [5, 10, 50],
  GBP: [5, 10, 50],
  KES: [500, 1_000, 5_000],
  GHS: [50, 100, 500],
  ZAR: [100, 200, 1_000],
};

// Raw decimal string in and out ("10000.5"); shown grouped ("10,000.5") with the currency symbol.
// `onMax`: a Max chip first (e.g. selling everything held), for the screen to fill in.
// `percentOf`: what's held (a decimal string): 25%, 50% and 75% of it replace the fixed amounts.
export function AmountInput({
  label,
  value,
  onChange,
  currency,
  onMax,
  maxActive,
  percentOf,
}: {
  label: string;
  value: string;
  onChange: (raw: string) => void;
  currency: DisplayCurrency;
  onMax?: () => void;
  maxActive?: boolean;
  percentOf?: string;
}) {
  const [focused, setFocused] = useState(false);
  // A share of what's held, rounded down to the cent so it never asks for more than there is.
  const share = (pct: number) => (Math.floor(Number(percentOf) * pct) / 100).toFixed(2);
  const maxChip = onMax ? (
    <Pressable
      onPress={onMax}
      accessibilityRole="button"
      accessibilityState={{ selected: !!maxActive }}
      style={[styles.chip, maxActive && styles.chipActive]}>
      <Text variant="label" color={maxActive ? 'textOnAccent' : 'textPrimary'}>
        Max
      </Text>
    </Pressable>
  ) : null;
  return (
    <Card style={[styles.card, focused && styles.cardFocused]}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <View style={styles.row}>
        <Text variant="display" color="textSecondary">
          {currencySymbol(currency)}
        </Text>
        <TextInput
          value={groupDigits(value)}
          onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
          placeholder="0"
          placeholderTextColor={colors.textDisabled}
          keyboardType="decimal-pad"
          style={styles.input}
          selectionColor={colors.accentPink}
          underlineColorAndroid="transparent"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={`${label}, in ${currency}`}
        />
      </View>
      <View style={styles.quick}>
        {onMax && !percentOf ? maxChip : null}
        {percentOf && Number(percentOf) > 0
          ? [25, 50, 75].map((pct) => {
              const active = !maxActive && value === share(pct);
              return (
                <Pressable
                  key={pct}
                  onPress={() => onChange(share(pct))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text variant="label" color={active ? 'textOnAccent' : 'textPrimary'}>
                    {pct}%
                  </Text>
                </Pressable>
              );
            })
          : QUICK[currency].map((q) => (
              <Pressable key={q} onPress={() => onChange(String(q))} style={styles.chip}>
                <Text variant="label">{formatMoney({ amount: String(q), currency }).replace(/\.00$/, '')}</Text>
              </Pressable>
            ))}
        {/* Selling: 25%, 50%, 75%, then Max; typing is the custom amount. */}
        {onMax && percentOf ? maxChip : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.bgSurface,
  },
  cardFocused: {
    borderColor: colors.textDisabled,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    minWidth: 0,
    ...typeScale.display,
    color: colors.textPrimary,
    padding: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  quick: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSurfaceAlt,
  },
  chipActive: {
    backgroundColor: colors.accentPink,
  },
});
