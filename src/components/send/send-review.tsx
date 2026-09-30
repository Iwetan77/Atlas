import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { SendQuote } from '@/api/contract';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { MoneyError } from '@/components/money-error';
import { formatMoney } from '@/format/money';
import { colors, spacing } from '@/theme';

// What the engine quoted for a send, before the one confirmation.
export function SendReview({
  quote,
  quoting,
  error,
  secondsLeft,
}: {
  quote: SendQuote | null;
  quoting: boolean;
  error: string | null;
  secondsLeft: number;
}) {
  if (quote) {
    return (
      <Card variant="outlined" style={styles.card}>
        <Row label="To" value={quote.destinationLabel} />
        <Row label="They get" value={formatMoney(quote.receive)} strong />
        <Row label="Fee" value={Number(quote.fee.amount) === 0 ? 'Free' : formatMoney(quote.fee)} />
        <Row label="Arrives" value={quote.eta} />
        <Text variant="caption" color="textSecondary">
          {quoting ? 'Updating…' : `Held for ${secondsLeft}s`}
        </Text>
      </Card>
    );
  }
  if (quoting) {
    return (
      <View style={styles.busy}>
        <ActivityIndicator color={colors.accentPink} />
        <Text color="textSecondary">Working out the details…</Text>
      </View>
    );
  }
  if (error) return <MoneyError message={error} />;
  return null;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text color="textSecondary">{label}</Text>
      <Text variant={strong ? 'heading' : 'bodyStrong'} style={styles.value} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
  busy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
