import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { DisplayCurrency } from '@/api/contract';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { currencySymbol, formatMoney, groupDigits } from '@/format/money';
import { colors, radii, spacing, type as typeScale } from '@/theme';

// Quick picks per display currency, roughly the same spend everywhere.
const QUICK: Record<DisplayCurrency, number[]> = {
  NGN: [5_000, 10_000, 50_000],
  USD: [5, 10, 50],
  KES: [500, 1_000, 5_000],
  GHS: [50, 100, 500],
  ZAR: [100, 200, 1_000],
};

// Raw decimal string in and out ("10000.5"); shown grouped ("10,000.5") with the currency symbol.
export function AmountInput({
  label,
  value,
  onChange,
  currency,
}: {
  label: string;
  value: string;
  onChange: (raw: string) => void;
  currency: DisplayCurrency;
}) {
  return (
    <Card style={styles.card}>
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
          accessibilityLabel={`${label}, in ${currency}`}
        />
      </View>
      <View style={styles.quick}>
        {QUICK[currency].map((q) => (
          <Pressable key={q} onPress={() => onChange(String(q))} style={styles.chip}>
            <Text variant="label">{formatMoney({ amount: String(q), currency }).replace(/\.00$/, '')}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    ...typeScale.display,
    color: colors.textPrimary,
    padding: 0,
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
});
