import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { BalanceResponse, Holding } from '@/api/contract';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { formatMoney, formatTokenNumber, HIDDEN } from '@/format/money';
import { colors, spacing } from '@/theme';

// The stocks, memes and crypto the user owns, most valuable first. Cash is the balance above;
// perps margin and positions live in Perps, not here.
export function YourAssets({ balance, stealth }: { balance: BalanceResponse | null; stealth: boolean }) {
  if (!balance) return null;
  const owned = balance.holdings
    .filter((h) => h.kind !== 'cash' && h.location !== 'perps' && Number(h.amount) > 0)
    .sort((a, b) => Number(b.value.amount) - Number(a.value.amount));

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
            <AssetRow key={`${h.assetId}:${h.chain}`} holding={h} stealth={stealth} divider={i > 0} />
          ))}
        </Card>
      )}
    </View>
  );
}

function AssetRow({ holding: h, stealth, divider }: { holding: Holding; stealth: boolean; divider: boolean }) {
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
      <Text variant="bodyStrong">{stealth ? HIDDEN : formatMoney(h.value)}</Text>
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
});
