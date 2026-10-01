import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { BalanceResponse, Holding, SpotPosition } from '@/api/contract';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { formatMoney, formatTokenNumber, HIDDEN, hiddenMoney } from '@/format/money';
import { colors, spacing } from '@/theme';

// The stocks, memes and crypto the user owns, most valuable first: one row each with its gain or
// loss. Tapping one opens its screen, where the position's share card lives and stays live. Cash is
// the balance above; perps margin and positions live in Perps, not here.
export function YourAssets({
  balance,
  positions,
  stealth,
}: {
  balance: BalanceResponse | null;
  positions: SpotPosition[] | null;
  stealth: boolean;
}) {
  if (!balance) return null;
  const owned = balance.holdings
    .filter((h) => h.kind !== 'cash' && h.location !== 'perps' && Number(h.amount) > 0)
    .sort((a, b) => Number(b.value.amount) - Number(a.value.amount));
  const byAsset = new Map((positions ?? []).map((p) => [p.assetId, p]));

  return (
    <View style={styles.section}>
      <Text variant="overline" color="textSecondary">
        Your assets
      </Text>
      {owned.length === 0 ? (
        <Card style={styles.empty}>
          <Icon name="trending-up" size={26} color="textSecondary" />
          <Text color="textSecondary" style={styles.center}>
            Stocks, memes and crypto you buy show up here.
          </Text>
          <PillButton label="Explore markets" tone="secondary" size="sm" onPress={() => router.push('/trade')} />
        </Card>
      ) : (
        <Card style={styles.list}>
          {owned.map((h, i) => (
            <AssetRow key={`${h.assetId}:${h.chain}`} holding={h} position={byAsset.get(h.assetId)} stealth={stealth} divider={i > 0} />
          ))}
        </Card>
      )}
    </View>
  );
}

function AssetRow({
  holding: h,
  position,
  stealth,
  divider,
}: {
  holding: Holding;
  position: SpotPosition | undefined;
  stealth: boolean;
  divider: boolean;
}) {
  const pct = position?.pnlPct == null ? null : Number(position.pnlPct);
  // The asset screen shows a unit price; for a holding that's its value per token.
  const unit = Number(h.amount) > 0 ? Number(h.value.amount) / Number(h.amount) : 0;
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/trade/[assetId]',
          params: {
            assetId: h.assetId,
            symbol: h.symbol,
            name: h.name,
            price: String(unit),
            iconUrl: h.iconUrl ?? '',
            change: '',
          },
        })
      }
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}>
      <AssetAvatar symbol={h.symbol} iconUrl={h.iconUrl ?? null} />
      <View style={styles.rowText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {h.name}
        </Text>
        <Text variant="caption" color="textSecondary">
          {stealth ? HIDDEN : `${formatTokenNumber(h.amount)} ${h.symbol}`}
        </Text>
      </View>
      <View style={styles.rowValue}>
        <Text variant="bodyStrong">{stealth ? hiddenMoney(h.value.currency) : formatMoney(h.value)}</Text>
        {pct === null ? null : (
          <Text variant="caption" color={pct < 0 ? 'danger' : 'success'}>
            {`${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  center: {
    textAlign: 'center',
  },
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
  rowValue: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
});
