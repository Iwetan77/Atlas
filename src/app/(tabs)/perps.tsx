import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { PerpMarket } from '@/api/contract';
import { usePerpMarkets, usePerpPositions } from '@/api/perps';
import { PositionCard } from '@/components/perps/position-card';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatPrice } from '@/format/money';
import { colors, spacing } from '@/theme';

// Perpetuals on Paradex: open positions first (with their liquidation prices), then markets.
export default function PerpsScreen() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const { markets, error: marketsError, reload: reloadMarkets } = usePerpMarkets();
  const { account, error: positionsError } = usePerpPositions(focused);

  return (
    <Screen>
      <Text variant="title">Perps</Text>
      <Text color="textSecondary">Go long or short with leverage. Know your liquidation price before you open.</Text>

      {account && account.positions.length > 0 ? (
        <>
          <Text variant="overline" color="textSecondary">
            Your positions
          </Text>
          {account.positions.map((p) => (
            <PositionCard key={p.positionId} position={p} />
          ))}
        </>
      ) : positionsError && markets ? (
        <Text variant="caption" color="danger">
          Couldn&apos;t load your positions: {positionsError}
        </Text>
      ) : null}

      <Text variant="overline" color="textSecondary">
        Markets
      </Text>
      {markets ? (
        <Card style={styles.list}>
          {markets.map((m, i) => (
            <MarketRow key={m.marketId} market={m} divider={i > 0} />
          ))}
        </Card>
      ) : marketsError ? (
        <Card style={styles.state}>
          <Icon name="cloud-offline-outline" size={28} color="textSecondary" />
          <Text variant="heading">Perps aren&apos;t available right now</Text>
          <Text variant="caption" color="textSecondary">
            {marketsError}
          </Text>
          <Pressable onPress={reloadMarkets} hitSlop={8}>
            <Text variant="label" color="accentPinkTint">
              Try again
            </Text>
          </Pressable>
        </Card>
      ) : (
        <Text color="textSecondary">Loading markets…</Text>
      )}
    </Screen>
  );
}

function MarketRow({ market: m, divider }: { market: PerpMarket; divider: boolean }) {
  const change = m.change24hPct === null ? null : Number(m.change24hPct);
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/perps/[marketId]',
          params: {
            marketId: m.marketId,
            symbol: m.symbol,
            name: m.name,
            markPrice: m.markPrice.amount,
            maxLeverage: String(m.maxLeverage),
            change: m.change24hPct ?? '',
            funding: m.fundingRate8hPct ?? '',
          },
        })
      }
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}>
      <AssetAvatar symbol={m.symbol} iconUrl={null} />
      <View style={styles.rowText}>
        <Text variant="bodyStrong">{m.name}</Text>
        <Text variant="caption" color="textSecondary">
          Up to {m.maxLeverage}×
        </Text>
      </View>
      <View style={styles.rowPrice}>
        <Text variant="bodyStrong">{formatPrice(m.markPrice)}</Text>
        {change === null ? null : (
          <Text variant="caption" color={change >= 0 ? 'success' : 'danger'}>
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}%
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowPrice: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  state: {
    alignItems: 'center',
    gap: spacing.sm,
  },
});
