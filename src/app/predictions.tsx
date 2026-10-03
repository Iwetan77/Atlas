import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { executePrediction, predictionQuote, usePredictionAccount, usePredictionMarkets, type PredictionMarket, type PredictionPosition } from '@/api/predictions';
import { useRunIntent } from '@/api/intents';
import { useAtlasAuth } from '@/auth/context';
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

const TOPICS = ['All', 'Bitcoin', 'Politics', 'Football', 'Economy', 'Technology'];
export default function Predictions() {
  const desktop = useDesktop();
  const { getAccessToken } = useAtlasAuth();
  const runIntent = useRunIntent();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const { displayCurrency } = useSettings();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All');
  const [tab, setTab] = useState<'discover' | 'positions'>('discover');
  const { markets, loading, error, reload } = usePredictionMarkets(query || (topic === 'All' ? '' : topic));
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
  return (
    <Screen onRefresh={() => { reload(); reloadAccount(); }}>
      <BackHeader title="Predictions" />
      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.brand}>
            <Image source={require('../../assets/images/icon.png')} style={styles.brandImage} contentFit="cover" />
            <View style={styles.brandBadge}><Icon name="trending-up" size={13} color="tilePinkInk" /></View>
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="overline" color="accentPinkTint">Atlas Predictions</Text>
            <Text variant="caption" color="textSecondary">Powered by Polymarket</Text>
          </View>
          <View style={styles.heroArrow}><Icon name="sparkles-outline" size={22} color="accentPinkTint" /></View>
        </View>
        <Text variant="title" style={styles.heroTitle}>Your take on what comes next.</Text>
        <Text color="textSecondary">Explore real-world events. Choose the outcome you believe in.</Text>
        <View style={styles.heroNote}>
          <Icon name="information-circle-outline" size={18} color="accentPinkTint" />
          <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>A winning share pays out; a losing share can become worth nothing. Prices show the market&apos;s view, not a promise.</Text>
        </View>
      </Card>
      <View style={styles.tabs}>
        {(['discover', 'positions'] as const).map((key) => (
          <Pressable key={key} onPress={() => setTab(key)} accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }} style={[styles.tab, tab === key && styles.tabActive]}>
            <Text variant="bodyStrong" color={tab === key ? 'accentPinkTint' : 'textSecondary'}>
              {key === 'discover' ? 'Explore' : 'Your predictions'}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'discover' ? <>
        <Field clearable value={query} onChangeText={setQuery} placeholder="Search events, teams or topics"
          accessibilityLabel="Search prediction markets" autoCapitalize="none"
          prefix={<Icon name="search" color="textSecondary" />} />
        <View style={styles.topics}>
          {TOPICS.map((t) => (
            <Pressable key={t} onPress={() => { setTopic(t); setQuery(''); }}
              accessibilityRole="button" accessibilityState={{ selected: t === topic && !query }}
              style={[styles.chip, t === topic && !query && styles.chipActive]}>
              <Text variant="label" color={t === topic && !query ? 'tilePinkInk' : 'textSecondary'}>{t}</Text>
            </Pressable>
          ))}
        </View>
        {loading ? <ActivityIndicator color={colors.accentPink} /> : null}
        {error ? <Card><Text color="danger">{error}</Text><PillButton label="Try again" onPress={reload} size="sm" /></Card> : null}
        {!loading && !error && markets?.length === 0 ? <Card><Text>No open markets match this search. Try another name or topic.</Text></Card> : null}
        <View style={styles.sectionHeading}>
          <Text variant="heading">{query ? 'Search results' : topic === 'All' ? 'Explore markets' : topic + ' markets'}</Text>
          <Text variant="caption" color="textSecondary">{markets?.length ? markets.length + ' events' : ''}</Text>
        </View>
        <View style={styles.markets}>
          {markets?.map((m) => <MarketTile key={m.marketId} market={m} desktop={desktop} />)}
        </View>
      </> : <>
        <Card style={styles.cashCard}>
          <View style={styles.between}><Text variant="overline" color="textSecondary">Predictions cash</Text><View style={styles.cashIcon}><Icon name="wallet-outline" color="accentPinkTint" size={20} /></View></View>
          <Text variant="title" style={styles.cashValue}>{account ? formatMoney(account.cash) : '—'}</Text>
          <Text variant="caption" color="textSecondary">Cash available for your next prediction, or to return to your Atlas balance.</Text>
          <PillButton label="Return cash to Atlas" icon="arrow-down" tone="secondary"
            disabled={!account || Number(account.cashUnits) <= 0}
            onPress={() => router.push('/predictions/cash')} />
        </Card>
        {accountError ? <Text color="danger">{accountError}</Text> : null}
        {claimError ? <Text color="danger">{claimError}</Text> : null}
        {availability?.reason ? <Text variant="caption" color="textSecondary">{availability.reason}</Text> : null}
        {!account ? <ActivityIndicator color={colors.accentPink} /> : account.positions.length === 0 ? (
          <Card variant="outlined" style={styles.empty}><View style={styles.emptyIcon}><Icon name="ticket-outline" size={30} color="accentPinkTint" /></View>
            <Text variant="bodyStrong">Your first prediction starts here.</Text>
            <Text color="textSecondary">Explore an event and choose the outcome you believe in.</Text>
            <PillButton label="Explore markets" onPress={() => setTab('discover')} />
          </Card>
        ) : account.positions.map((p) => (
          <Card key={p.positionId} style={styles.position}>
            <View style={styles.row}>
              {p.iconUrl ? <Image source={{ uri: p.iconUrl }} style={styles.image} contentFit="cover" /> : <View style={styles.emptyIcon}><Icon name="ticket-outline" color="accentPinkTint" /></View>}
              <Text variant="bodyStrong" style={{ flex: 1 }}>{p.question}</Text>
            </View>
            <View style={styles.between}><View style={styles.positionLabel}><Text variant="label" color="accentPinkTint">{p.outcome}</Text></View>
              <Text variant="bodyStrong">{formatMoney(p.value)}</Text></View>
            <Text variant="caption" color="textSecondary">{p.shares} shares held</Text>
            <Text color={Number(p.pnl.amount) >= 0 ? 'success' : 'danger'}>{formatMoney(p.pnl)} return so far</Text>
            {p.marketId ? <PillButton label="View prediction" size="sm" tone="secondary"
              onPress={() => router.push({ pathname: '/predictions/[marketId]', params: { marketId: p.marketId, tokenId: p.tokenId } })} /> : null}
            {p.redeemable ? <PillButton label="Claim winnings" size="sm" loading={claiming === p.positionId} disabled={claiming !== null} onPress={() => claim(p)} /> : null}
          </Card>
        ))}
      </>}
      <Pressable onPress={() => router.push('/transactions')} accessibilityRole="button" style={styles.historyLink}>
        <Icon name="time-outline" color="accentPinkTint" size={17} /><Text variant="label" color="accentPinkTint">View your transaction history</Text><Icon name="arrow-forward" color="accentPinkTint" size={16} />
      </Pressable>
    </Screen>
  );
}
function MarketTile({ market: m, desktop }: { market: PredictionMarket; desktop: boolean }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/predictions/[marketId]', params: { marketId: m.marketId } })}
      accessibilityRole="button" accessibilityLabel={m.question}
      style={({ pressed }) => [styles.market, desktop && { width: '48%', flexGrow: 1 }, pressed && { opacity: 0.8 }]}>
      <View style={styles.row}>
        {m.iconUrl ? <Image source={{ uri: m.iconUrl }} style={styles.image} contentFit="cover" /> : <View style={styles.emptyIcon}><Icon name="analytics-outline" size={24} color="accentPinkTint" /></View>}
        <Text variant="bodyStrong" style={{ flex: 1 }}>{m.question}</Text>
      </View>
      <View style={styles.outcomes}>{m.outcomes.map((o, i) => (
        <View key={o.tokenId} style={[styles.outcome, i === 0 && styles.firstOutcome]}>
          <View style={styles.between}><Text variant="label" color={i === 0 ? 'accentPinkTint' : 'tileBlue'}>{o.label}</Text>
            <View style={[styles.dot, { backgroundColor: i === 0 ? colors.accentPinkTint : colors.tileBlue }]} /></View>
          <Text variant="title" style={styles.probability}>{(Number(o.probability) * 100).toFixed(0)}%</Text>
          <View style={styles.probabilityTrack}><View style={[styles.probabilityFill, { width: Math.max(0, Math.min(100, Number(o.probability) * 100)) + '%' as `${number}%`, backgroundColor: i === 0 ? colors.accentPinkTint : colors.tileBlue }]} /></View>
        </View>
      ))}</View>
      <View style={styles.marketFooter}>
        <View style={styles.date}><Icon name="calendar-outline" color="textSecondary" size={14} />
          <Text variant="caption" color="textSecondary">{m.endDate ? 'Ends ' + new Date(m.endDate).toLocaleDateString() : 'Read resolution rules'}</Text></View>
        <View style={styles.openArrow}><Icon name="arrow-forward" color="accentPinkTint" size={17} /></View>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  hero: { gap: spacing.md, padding: spacing.xl, backgroundColor: colors.bgTabBar, borderWidth: 1, borderColor: colors.border },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroTitle: { fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  heroNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.bgBase, borderRadius: radii.md, padding: spacing.md },
  heroArrow: { width: 42, height: 42, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentPinkMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  brand: { width: 46, height: 46 },
  brandImage: { width: 46, height: 46, borderRadius: radii.md },
  brandBadge: { position: 'absolute', right: -3, bottom: -3, width: 22, height: 22, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.bgTabBar, backgroundColor: colors.tilePink, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: spacing.xs, padding: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.bgTabBar },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radii.pill },
  tabActive: { backgroundColor: colors.bgSurface },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.bgSurface },
  chipActive: { backgroundColor: colors.tilePink },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  markets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  market: { width: '100%', backgroundColor: colors.bgSurface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.lg, borderWidth: 1, borderColor: colors.border },
  image: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.bgSurfaceAlt },
  outcomes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  outcome: { flex: 1, minWidth: 100, padding: spacing.md, borderRadius: radii.md, gap: spacing.sm, backgroundColor: colors.bgTabBar },
  firstOutcome: { backgroundColor: colors.accentPinkMuted },
  dot: { width: 6, height: 6, borderRadius: radii.pill },
  probability: { fontSize: 28, lineHeight: 32 },
  probabilityTrack: { height: 3, borderRadius: radii.pill, overflow: 'hidden', backgroundColor: colors.border },
  probabilityFill: { height: '100%', borderRadius: radii.pill },
  marketFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingTop: spacing.md },
  date: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  openArrow: { width: 28, height: 28, borderRadius: radii.pill, backgroundColor: colors.bgTabBar, alignItems: 'center', justifyContent: 'center' },
  cashCard: { gap: spacing.md, backgroundColor: colors.bgTabBar, borderWidth: 1, borderColor: colors.border },
  cashIcon: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentPinkMuted },
  cashValue: { fontSize: 34, lineHeight: 40 },
  empty: { gap: spacing.md },
  emptyIcon: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.accentPinkMuted, alignItems: 'center', justifyContent: 'center' },
  position: { gap: spacing.md },
  positionLabel: { backgroundColor: colors.accentPinkMuted, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  historyLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
});
