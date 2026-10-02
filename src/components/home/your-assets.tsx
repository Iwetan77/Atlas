import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { BalanceResponse, Holding, SpotPosition } from '@/api/contract';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { formatMoney, formatTokenNumber, HIDDEN, hiddenMoney } from '@/format/money';
import { colors, radii, spacing } from '@/theme';
import { useDesktop } from '@/web/use-desktop';

// The stocks, memes and crypto the user owns, most valuable first: a row of cards to swipe through,
// each with its gain or loss. Tapping one opens its screen, where the position's share card lives and stays live. Cash is
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
  const desktop = useDesktop();
  if (!balance) return null;
  const owned = balance.holdings
    .filter((h) => h.kind !== 'cash' && h.location !== 'perps' && Number(h.amount) > 0)
    .sort((a, b) => Number(b.value.amount) - Number(a.value.amount));
  const byAsset = new Map((positions ?? []).map((p) => [p.assetId, p]));

  return (
    <View style={styles.section}>
      <View style={styles.sectionLabel}>
        <Icon name="layers-outline" size={14} color="textSecondary" />
        <Text variant="overline" color="textSecondary">Your assets</Text>
      </View>
      {owned.length === 0 ? (
        <Card style={styles.empty}>
          <Icon name="trending-up" size={26} color="textSecondary" />
          <Text color="textSecondary" style={styles.center}>
            Stocks, memes and crypto you buy show up here.
          </Text>
          <PillButton label="Explore markets" tone="secondary" size="sm" onPress={() => router.push('/trade')} />
        </Card>
      ) : desktop ? (
        <View style={styles.desktopGrid}>{owned.map((h) => <AssetCard key={`${h.assetId}:${h.chain}`} holding={h} position={byAsset.get(h.assetId)} stealth={stealth} desktop />)}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.strip}
          contentContainerStyle={styles.stripContent}>
          {owned.map((h) => (
            <AssetCard key={`${h.assetId}:${h.chain}`} holding={h} position={byAsset.get(h.assetId)} stealth={stealth} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function AssetCard({
  holding: h,
  position,
  stealth,
  desktop = false,
}: {
  desktop?: boolean;
  holding: Holding;
  position: SpotPosition | undefined;
  stealth: boolean;
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
      accessibilityRole="button"
      accessibilityLabel={h.name}
      style={({ pressed }) => [styles.card, desktop && styles.desktopCard, pressed && styles.pressed]}>
      <AssetAvatar symbol={h.symbol} iconUrl={h.iconUrl ?? null} />
      <View style={styles.cardText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {h.name}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {stealth ? HIDDEN : `${formatTokenNumber(h.amount)} ${h.symbol}`}
        </Text>
      </View>
      <View style={styles.cardText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {stealth ? hiddenMoney(h.value.currency) : formatMoney(h.value)}
        </Text>
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
  desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  desktopCard: { flexGrow: 1, flexBasis: 175, minWidth: 150, maxWidth: '100%' },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  // Edge to edge: the cards scroll under the screen's side padding, starting in line with it.
  strip: {
    marginHorizontal: -spacing.lg,
  },
  stripContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    width: 152,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.bgSurface,
  },
  pressed: {
    opacity: 0.7,
  },
  cardText: {
    gap: spacing.xxs,
  },
});
