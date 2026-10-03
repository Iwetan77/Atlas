import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { executePrediction, predictionQuote, usePredictionAccount, usePredictionMarkets, type PredictionPosition } from '@/api/predictions';
import { useRunIntent } from '@/api/intents';
import { useAtlasAuth } from '@/auth/context';
import { MarketArt } from '@/components/predictions/market-art';
import { MarketCard } from '@/components/predictions/market-card';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/format/money';
import { useSettings } from '@/settings/context';
import { colors, radii, spacing } from '@/theme';
import { useDesktop } from '@/web/use-desktop';

// One scrollable row of topics; each is a search on Polymarket (All is today's busiest markets).
const TOPICS: { label: string; query: string }[] = [
  { label: 'All', query: '' },
  { label: 'Bitcoin', query: 'bitcoin' },
  { label: 'Politics', query: 'politics' },
  { label: 'Football', query: 'football' },
  { label: 'Economy', query: 'economy' },
  { label: 'Crypto', query: 'crypto' },
  { label: 'Elections', query: 'election' },
  { label: 'Nigeria', query: 'nigeria' },
  { label: 'Africa', query: 'africa' },
  { label: 'Fed rates', query: 'fed' },
  { label: 'AI', query: 'ai' },
  { label: 'Tech', query: 'tech' },
  { label: 'World', query: 'geopolitics' },
  { label: 'Culture', query: 'culture' },
];

export default function Predictions() {
  const desktop = useDesktop();
  const { getAccessToken } = useAtlasAuth();
  const runIntent = useRunIntent();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const { displayCurrency } = useSettings();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [tab, setTab] = useState<'discover' | 'positions'>('discover');
  const { markets, loading, error, reload } = usePredictionMarkets(query || topic.query);
  const { account, availability, error: accountError, reload: reloadAccount } = usePredictionAccount(displayCurrency);
  const claim = async (p: PredictionPosition) => {
    setClaiming(p.positionId); setClaimError(null);
    try {
      const q = await predictionQuote(getAccessToken, { side: 'redeem', tokenId: p.tokenId, amount: { amount: '1', currency: displayCurrency } });
      const final = await runIntent(() => executePrediction(getAccessToken, q.quoteId));
      if (final?.state === 'failed') setClaimError(final.error ?? 'Claim did not settle.');
      reloadAccount();
    } catch (e) { setClaimError(e instanceof Error ? e.message : 'Claim could not finish.'); }
    finally { setClaiming(null); }
  };
  const heading = query ? 'Search results' : topic.query ? topic.label : 'Top markets';
  return (
    <Screen onRefresh={() => { reload(); reloadAccount(); }}>
      <BackHeader title="Predictions" />

      <View style={styles.hero}>
        <View style={styles.wash} />
        <View style={styles.brandRow}>
          <Image source={require('../../assets/images/icon.png')} style={styles.brand} contentFit="cover" />
          <View style={styles.brandText}>
            <Text variant="bodyStrong" color="textOnAccent">Atlas Predictions</Text>
            <Text variant="caption" color="textOnAccent" style={styles.soft}>Powered by Polymarket</Text>
          </View>
        </View>
        <Text variant="title" color="textOnAccent" style={styles.heroTitle}>Your take on what comes next.</Text>
        <Text color="textOnAccent" style={styles.soft}>Pick the outcome you believe in. If you&apos;re right, each share pays out.</Text>
      </View>

      <View style={styles.tabs}>
        {(['discover', 'positions'] as const).map((key) => (
          <Pressable key={key} onPress={() => setTab(key)} accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }} style={[styles.tab, tab === key && styles.tabActive]}>
            <Text variant="bodyStrong" color={tab === key ? 'textPrimary' : 'textSecondary'}>
              {key === 'discover' ? 'Explore' : 'Your predictions'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'discover' ? <>
        <Field clearable value={query} onChangeText={setQuery} placeholder="Search events, teams or topics"
          accessibilityLabel="Search prediction markets" autoCapitalize="none"
          prefix={<Icon name="search" color="textSecondary" />} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicsBleed} contentContainerStyle={styles.topics}>
          {TOPICS.map((t) => {
            const on = t.label === topic.label && !query;
            return (
              <Pressable key={t.label} onPress={() => { setTopic(t); setQuery(''); }}
                accessibilityRole="button" accessibilityState={{ selected: on }}
                style={({ pressed }) => [styles.chip, on && styles.chipActive, pressed && styles.pressed]}>
                <Text variant="label" color={on ? 'textOnAccent' : 'textSecondary'}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.sectionHeading}>
          <Text variant="heading">{heading}</Text>
          {markets?.length ? <Text variant="caption" color="textSecondary">{markets.length} open</Text> : null}
        </View>
        {loading && !markets?.length ? <ActivityIndicator color={colors.accentPink} style={styles.loading} /> : null}
        {error ? <Card style={styles.gap}><Text color="danger">{error}</Text><PillButton label="Try again" onPress={reload} size="sm" /></Card> : null}
        {!loading && !error && markets?.length === 0 ? (
          <Card style={styles.empty}>
            <Icon name="search" size={22} color="accentPinkTint" />
            <Text color="textSecondary" style={styles.center}>No open markets match this yet. Try another name or topic.</Text>
          </Card>
        ) : null}
        <View style={styles.markets}>
          {markets?.map((m) => <MarketCard key={m.marketId} market={m} wide={desktop} />)}
        </View>
      </> : <>
        <View style={styles.cash}>
          <View style={styles.cashTop}>
            <View style={styles.cashIcon}><Icon name="wallet-outline" color="accentPinkTint" size={18} /></View>
            <Text variant="label" color="textSecondary">Predictions cash</Text>
          </View>
          <Text variant="title" style={styles.cashValue}>{account ? formatMoney(account.cash) : '—'}</Text>
          <Text variant="caption" color="textSecondary">Ready for your next prediction, or to return to your Atlas balance.</Text>
          <PillButton label="Return cash to Atlas" icon="arrow-down" tone="secondary" size="sm"
            disabled={!account || Number(account.cashUnits) <= 0}
            onPress={() => router.push('/predictions/cash')} />
        </View>
        {accountError ? <Text color="danger">{accountError}</Text> : null}
        {claimError ? <Text color="danger">{claimError}</Text> : null}
        {availability?.reason ? <Text variant="caption" color="textSecondary">{availability.reason}</Text> : null}
        {!account ? <ActivityIndicator color={colors.accentPink} style={styles.loading} /> : account.positions.length === 0 ? (
          <Card style={styles.empty}>
            <View style={styles.emptyIcon}><Icon name="planet-outline" size={26} color="accentPinkTint" /></View>
            <Text variant="bodyStrong" style={styles.center}>Your first prediction starts here.</Text>
            <Text color="textSecondary" style={styles.center}>Explore an event and pick the outcome you believe in.</Text>
            <PillButton label="Explore markets" onPress={() => setTab('discover')} />
          </Card>
        ) : account.positions.map((p) => {
          const up = Number(p.pnl.amount) >= 0;
          return (
            <Pressable key={p.positionId} disabled={!p.marketId}
              onPress={() => router.push({ pathname: '/predictions/[marketId]', params: { marketId: p.marketId, tokenId: p.tokenId } })}
              style={({ pressed }) => [styles.position, pressed && styles.pressed]}>
              <View style={styles.positionTop}>
                <MarketArt uri={p.iconUrl} question={p.question} size={40} />
                <View style={styles.positionText}>
                  <Text variant="bodyStrong" numberOfLines={2}>{p.question}</Text>
                  <View style={styles.positionMeta}>
                    <View style={styles.outcomeChip}><Text variant="label" color="accentPinkTint">{p.outcome}</Text></View>
                    <Text variant="caption" color="textSecondary">{Number(p.shares).toFixed(2)} shares</Text>
                  </View>
                </View>
              </View>
              <View style={styles.positionNumbers}>
                <View>
                  <Text variant="caption" color="textSecondary">Worth now</Text>
                  <Text variant="bodyStrong">{formatMoney(p.value)}</Text>
                </View>
                <View style={styles.right}>
                  <Text variant="caption" color="textSecondary">Return</Text>
                  <Text variant="bodyStrong" color={up ? 'success' : 'danger'}>{up ? '+' : ''}{formatMoney(p.pnl)}</Text>
                </View>
              </View>
              {p.redeemable ? <PillButton label="Claim winnings" size="sm" loading={claiming === p.positionId} disabled={claiming !== null} onPress={() => claim(p)} /> : null}
            </Pressable>
          );
        })}
      </>}

      <View style={styles.footer}>
        <View style={styles.risk}>
          <Icon name="shield-checkmark-outline" size={16} color="textSecondary" />
          <Text variant="caption" color="textSecondary" style={styles.flex}>
            A winning share pays out; a losing one can become worth nothing. Prices show the market&apos;s view, not a promise.
          </Text>
        </View>
        <Pressable onPress={() => router.push('/transactions')} accessibilityRole="button" style={styles.historyLink}>
          <Icon name="time-outline" color="accentPinkTint" size={16} />
          <Text variant="label" color="accentPinkTint">Your transaction history</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The Home balance card's Atlas pink, with its decorative circle.
  hero: { gap: spacing.md, padding: spacing.xl, borderRadius: 28, backgroundColor: colors.accentPink, overflow: 'hidden' },
  wash: { position: 'absolute', right: -60, top: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.accentPinkWash },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brand: { width: 40, height: 40, borderRadius: 12, borderWidth: 2, borderColor: colors.onAccentSoft },
  brandText: { gap: spacing.xxs },
  soft: { opacity: 0.88 },
  heroTitle: { fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  tabs: { flexDirection: 'row', gap: spacing.xs, padding: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.bgTabBar },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 2, borderRadius: radii.pill },
  tabActive: { backgroundColor: colors.bgSurface },
  // The topic row runs to the screen's edges, so it reads as scrollable.
  topicsBleed: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  topics: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.bgTabBar },
  chipActive: { backgroundColor: colors.accentPink },
  pressed: { opacity: 0.85 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  loading: { marginVertical: spacing.xl },
  gap: { gap: spacing.md },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  emptyIcon: { width: 52, height: 52, borderRadius: radii.pill, backgroundColor: colors.accentPinkMuted, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  markets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cash: { gap: spacing.sm, padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.bgTabBar },
  cashTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cashIcon: { width: 32, height: 32, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentPinkMuted },
  cashValue: { fontSize: 32, lineHeight: 38 },
  position: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.bgSurface },
  positionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  positionText: { flex: 1, gap: spacing.sm },
  positionMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  outcomeChip: { backgroundColor: colors.accentPinkMuted, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xxs },
  positionNumbers: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  right: { alignItems: 'flex-end' },
  footer: { gap: spacing.md, marginTop: spacing.sm },
  risk: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  flex: { flex: 1 },
  historyLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
});
