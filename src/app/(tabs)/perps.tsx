import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { PerpCategory, PerpMarket } from '@/api/contract';
import { usePerpMarkets, usePerpPositions } from '@/api/perps';
import { useMe } from '@/api/send';
import { PositionCard } from '@/components/perps/position-card';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { PillButton } from '@/components/ui/pill-button';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatPrice } from '@/format/money';
import { colors, radii, spacing } from '@/theme';

type Filter = 'all' | PerpCategory;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'stock', label: 'Stocks' },
  { key: 'commodity', label: 'Commodities' },
  { key: 'index', label: 'Indices' },
  { key: 'currency', label: 'Currencies' },
  { key: 'meme', label: 'Memes' },
];

// Perpetuals on Hyperliquid: open positions first (with their liquidation prices), then every market
// it lists, most traded first, with search and category chips.
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
  const { me } = useMe();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  // Markets and Positions are two views of the same tab. Opening a trade lands on Positions: each
  // "See position" carries a fresh `at`, which wins over whatever was tapped before it.
  const { view: viewParam, at } = useLocalSearchParams<{ view?: string; at?: string }>();
  const [choice, setChoice] = useState<{ view: 'markets' | 'positions'; at?: string }>({ view: 'markets' });
  const view = viewParam === 'positions' && at && choice.at !== at ? 'positions' : choice.view;
  const setView = (v: 'markets' | 'positions') => setChoice({ view: v, at });
  const positionCount = account?.positions.length ?? 0;

  const q = query.trim().toLowerCase();
  const shown = markets?.filter(
    (m) =>
      (filter === 'all' || m.category === filter) &&
      (!q || m.name.toLowerCase().includes(q) || m.symbol.toLowerCase().includes(q)),
  );
  // Only offer chips that have markets behind them.
  const filters = FILTERS.filter((f) => f.key === 'all' || markets?.some((m) => m.category === f.key));

  return (
    <Screen>
      <View style={styles.titleRow}>
        <Text variant="title">Perps</Text>
      </View>
      <Text color="textSecondary">Go long or short with leverage. Know your liquidation price before you open.</Text>

      <View style={styles.segment}>
        {(['markets', 'positions'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === v }}
            style={[styles.segmentItem, view === v && styles.segmentActive]}>
            <Text variant="bodyStrong" color={view === v ? 'textOnAccent' : 'textSecondary'}>
              {v === 'markets' ? 'Markets' : `Positions${positionCount ? ` · ${positionCount}` : ''}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Positions live here, never on Home: each one as its share card. */}
      {view === 'positions' ? (
        account && positionCount > 0 ? (
          account.positions.map((p) => <PositionCard key={p.positionId} position={p} handle={me?.handle ?? null} />)
        ) : positionsError ? (
          <Text variant="caption" color="textSecondary">
            {positionsError}
          </Text>
        ) : (
          <Card style={styles.emptyPositions}>
            <Icon name="pulse-outline" size={28} color="textSecondary" />
            <Text variant="heading">No open positions</Text>
            <Text color="textSecondary">Positions you open show here, with their liquidation price.</Text>
            <PillButton label="Browse markets" tone="secondary" size="sm" onPress={() => setView('markets')} />
          </Card>
        )
      ) : null}

      {view !== 'markets' ? null : markets ? (
        <>
          <Field
            prefix={<Icon name="search" size={20} color="textSecondary" />}
            placeholder="Search Bitcoin, gold, Tesla…"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}>
            {filters.map((f) => {
              const active = f.key === filter;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, { backgroundColor: active ? colors.accentPink : colors.bgSurface }]}>
                  <Text variant="label" color={active ? 'textOnAccent' : 'textSecondary'}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {shown && shown.length > 0 ? (
            <Card style={styles.list}>
              {shown.map((m, i) => (
                <MarketRow key={m.marketId} market={m} divider={i > 0} />
              ))}
            </Card>
          ) : (
            <Text color="textSecondary">No markets match &ldquo;{query}&rdquo;.</Text>
          )}
        </>
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
            iconUrl: m.iconUrl ?? '',
          },
        })
      }
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}>
      <AssetAvatar symbol={m.symbol} iconUrl={m.iconUrl} />
      <View style={styles.rowText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {m.name}
        </Text>
        <Text variant="caption" color="textSecondary">
          {m.name === m.symbol ? '' : `${m.symbol} · `}Up to {m.maxLeverage}×
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyPositions: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  segment: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSurface,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  segmentActive: {
    backgroundColor: colors.accentPink,
  },
  // A horizontal row never grows vertically, however few chips it holds.
  chipsScroll: {
    flexGrow: 0,
  },
  chips: {
    gap: spacing.sm,
    alignItems: 'center',
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
});
