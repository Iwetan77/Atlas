import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { AssetCategory, MarketAsset } from '@/api/contract';
import { useAssets } from '@/api/markets';
import { TokenChainLogo } from '@/components/token-chain-logo';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatPrice } from '@/format/money';
import { colors, radii, spacing } from '@/theme';

// Stocks, memes and crypto share one list and one buy flow; chips only filter.
const CATEGORIES: { key: AssetCategory; label: string }[] = [
  // Who's rising most, each kind against its own (the engine still calls it "popular").
  { key: 'popular', label: 'Trending' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'stocks', label: 'Stocks' },
  { key: 'memes', label: 'Memes' },
];

export default function TradeScreen() {
  const [category, setCategory] = useState<AssetCategory>('popular');
  const [query, setQuery] = useState('');
  const { assets, error, loading, incomplete, searchingMore, reload } = useAssets(category, query);

  return (
    <Screen>
      <Text variant="title">Trade</Text>
      <Field
        prefix={<Icon name="search" size={20} color="textSecondary" />}
        placeholder="Search by name, or paste a token address"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={reload}
      />
      <View style={styles.chips}>
        {CATEGORIES.map((c) => {
          const active = c.key === category;
          return (
            <Pressable
              key={c.key}
              onPress={() => setCategory(c.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.chip, { backgroundColor: active ? colors.accentPink : colors.bgSurface }]}>
              <Text variant="label" color={active ? 'textOnAccent' : 'textSecondary'}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* While a search or a chip change is loading, show that it's loading, not the old list. */}
      {loading || (searchingMore && !assets?.length) ? (
        <Card style={styles.list} accessibilityLabel={query.trim() ? `Searching for ${query.trim()}` : 'Loading markets'}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.row, i > 0 && styles.divider]}>
              <View style={styles.skeletonAvatar} />
              <View style={styles.skeletonLine} />
            </View>
          ))}
        </Card>
      ) : error ? (
        <Card style={styles.state}>
          <Icon name="cloud-offline-outline" size={28} color="textSecondary" />
          <Text variant="heading">{query.trim() ? "Search didn't finish" : "Markets aren't available right now"}</Text>
          <Text variant="caption" color="textSecondary">
            {error}
          </Text>
          <Pressable onPress={reload} hitSlop={8}>
            <Text variant="label" color="accentPinkTint">
              Try again
            </Text>
          </Pressable>
        </Card>
      ) : assets && assets.length > 0 ? (
        <View style={styles.results}>
          {query.trim() && incomplete ? (
            <Pressable onPress={reload} accessibilityRole="button" style={styles.retry}>
              <Text variant="caption" color="textSecondary">{"Some results couldn't load."}</Text>
              <Text variant="label" color="accentPinkTint">Try again</Text>
            </Pressable>
          ) : null}
          <Card style={styles.list}>
            {assets.map((a, i) => (
              <AssetRow key={a.assetId} asset={a} divider={i > 0} />
            ))}
          </Card>
          {searchingMore ? (
            <View style={styles.more}>
              <ActivityIndicator size="small" color={colors.accentPink} />
              <Text variant="caption" color="textSecondary">
                Looking on other chains…
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Card style={styles.state}>
          <Text color="textSecondary">
            {query.trim() ? `Nothing matches “${query.trim()}”. Try a name, a ticker, or paste the token's address.` : 'No markets to show right now.'}
          </Text>
        </Card>
      )}
    </Screen>
  );
}

function AssetRow({ asset, divider }: { asset: MarketAsset; divider: boolean }) {
  const change = asset.change24hPct === null ? null : Number(asset.change24hPct);
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/trade/[assetId]',
          params: {
            assetId: asset.assetId,
            symbol: asset.symbol,
            name: asset.name,
            price: asset.price.amount,
            iconUrl: asset.iconUrl ?? '',
            change: asset.change24hPct ?? '',
            verified: asset.verified === false ? 'no' : 'yes',
            tradeable: asset.tradeable === false ? 'no' : 'yes',
          },
        })
      }
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}>
      <TokenChainLogo symbol={asset.symbol} iconUrl={asset.iconUrl} chain={asset.chain === 'solana' ? undefined : asset.chain} size={44} />
      <View style={styles.rowText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {asset.name}
        </Text>
        <View style={styles.symbolRow}>
          <Text variant="caption" color="textSecondary">
            {asset.symbol}
          </Text>
          {asset.verified === false ? (
            <View style={styles.unverified}>
              <Text variant="label" color="danger">
                Unverified
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.rowPrice}>
        <Text variant="bodyStrong">{formatPrice(asset.price)}</Text>
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
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  results: {
    gap: spacing.sm,
  },
  retry: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  unverified: {
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.dangerDim,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
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
  rowPrice: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  state: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgSurfaceAlt,
  },
  skeletonLine: {
    flex: 1,
    height: 16,
    borderRadius: radii.sm,
    backgroundColor: colors.bgSurfaceAlt,
  },
});
