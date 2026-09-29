import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { PerpPosition } from '@/api/contract';
import { LiquidationPrice } from '@/components/perps/liquidation-price';
import { SideBadge } from '@/components/perps/side-badge';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { formatMoney, formatPrice, formatTokenAmount } from '@/format/money';
import { spacing } from '@/theme';

export function PositionCard({ position: p }: { position: PerpPosition }) {
  const pnl = Number(p.unrealizedPnl.amount);
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="heading">{p.symbol}</Text>
        <SideBadge side={p.side} leverage={p.leverage} />
      </View>
      <View style={styles.pnl}>
        <Text variant="title" color={pnl >= 0 ? 'success' : 'danger'}>
          {pnl >= 0 ? '+' : ''}
          {formatMoney(p.unrealizedPnl)}
        </Text>
        <Text color={pnl >= 0 ? 'success' : 'danger'}>
          {pnl >= 0 ? '+' : ''}
          {Number(p.unrealizedPnlPct).toFixed(2)}%
        </Text>
      </View>
      <Row label="Size" value={formatTokenAmount(p.size, p.symbol)} />
      <Row label="Margin" value={formatMoney(p.margin)} />
      <Row label="Entry" value={formatPrice(p.entryPrice)} />
      <Row label="Mark" value={formatPrice(p.markPrice)} />
      <LiquidationPrice price={p.liquidationPrice} side={p.side} symbol={p.symbol} compact />
      <PillButton
        label="Close position"
        tone="secondary"
        size="sm"
        onPress={() =>
          router.push({
            pathname: '/perps/close/[positionId]',
            params: { positionId: p.positionId, symbol: p.symbol, side: p.side, leverage: String(p.leverage) },
          })
        }
      />
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text color="textSecondary">{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pnl: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
