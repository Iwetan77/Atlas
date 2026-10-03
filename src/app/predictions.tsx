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
      <Card variant="outlined" style={styles.hero}>
        <View style={styles.row}>
          <View style={styles.brand}><Icon name="analytics" size={28} color="accentPink" /></View>
          <View style={{ flex: 1 }}>
            <Text variant="title">Your take on what comes next.</Text>
            <Text variant="caption" color="textSecondary">Powered by Polymarket</Text>
          </View>
        </View>
        <Text color="textSecondary">Pick an outcome. A winning share pays out; a losing share can become worth nothing.</Text>
        <Text variant="caption" color="textSecondary">Prices show the market&apos;s view, not a promise. Read the rules before you choose.</Text>
      </Card>
      <View style={styles.tabs}>
        {(['discover', 'positions'] as const).map((key) => (
          <Pressable key={key} onPress={() => setTab(key)} accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }} style={[styles.tab, tab === key && styles.tabActive]}>
            <Text variant="bodyStrong" color={tab === key ? 'accentPink' : 'textSecondary'}>
              {key === 'discover' ? 'Explore' : 'Your predictions'}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'discover' ? <>
        <Field value={query} onChangeText={setQuery} placeholder="Search events, teams or topics"
          accessibilityLabel="Search prediction markets" autoCapitalize="none"
          prefix={<Icon name="search" color="textSecondary" />} />
        <View style={styles.topics}>
          {TOPICS.map((t) => (
            <Pressable key={t} onPress={() => { setTopic(t); setQuery(''); }}
              accessibilityRole="button" accessibilityState={{ selected: t === topic && !query }}
              style={[styles.chip, t === topic && !query && styles.chipActive]}>
              <Text variant="label" color={t === topic && !query ? 'textOnAccent' : 'textSecondary'}>{t}</Text>
            </Pressable>
          ))}
        </View>
        {loading ? <ActivityIndicator color={colors.accentPink} /> : null}
        {error ? <Card><Text color="danger">{error}</Text><PillButton label="Try again" onPress={reload} size="sm" /></Card> : null}
        {!loading && !error && markets?.length === 0 ? <Card><Text>No open markets match this search. Try another name or topic.</Text></Card> : null}
        <View style={styles.markets}>
          {markets?.map((m) => <MarketTile key={m.marketId} market={m} desktop={desktop} />)}
        </View>
      </> : <>
        <Card style={{ gap: spacing.md }}>
          <Text variant="overline" color="textSecondary">Predictions cash</Text>
          <Text variant="display">{account ? formatMoney(account.cash) : '—'}</Text>
          <Text variant="caption" color="textSecondary">Cash available for your next prediction, or to return to your Atlas balance.</Text>
          <PillButton label="Return cash to Atlas" icon="arrow-down" tone="secondary"
            disabled={!account || Number(account.cashUnits) <= 0}
            onPress={() => router.push('/predictions/cash')} />
        </Card>
        {accountError ? <Text color="danger">{accountError}</Text> : null}
        {claimError ? <Text color="danger">{claimError}</Text> : null}
        {availability?.reason ? <Text variant="caption" color="textSecondary">{availability.reason}</Text> : null}
        {!account ? <ActivityIndicator color={colors.accentPink} /> : account.positions.length === 0 ? (
          <Card variant="outlined"><Icon name="ticket-outline" size={32} color="accentPink" />
            <Text variant="bodyStrong">Your first prediction starts here.</Text>
            <Text color="textSecondary">Explore an event and choose the outcome you believe in.</Text>
            <PillButton label="Explore markets" onPress={() => setTab('discover')} />
          </Card>
        ) : account.positions.map((p) => (
          <Card key={p.positionId} style={{ gap: spacing.md }}>
            <Text variant="bodyStrong">{p.question}</Text>
            <View style={styles.row}><Text color="accentPink">{p.outcome}</Text>
              <Text color="textSecondary">{p.shares} shares</Text><Text variant="bodyStrong">{formatMoney(p.value)}</Text></View>
            <Text color={Number(p.pnl.amount) >= 0 ? 'success' : 'danger'}>{formatMoney(p.pnl)} return so far</Text>
            {p.marketId ? <PillButton label="View prediction" size="sm" tone="secondary"
              onPress={() => router.push({ pathname: '/predictions/[marketId]', params: { marketId: p.marketId, tokenId: p.tokenId } })} /> : null}
            {p.redeemable ? <PillButton label="Claim winnings" size="sm" loading={claiming === p.positionId} disabled={claiming !== null} onPress={() => claim(p)} /> : null}
          </Card>
        ))}
      </>}
      <Pressable onPress={() => router.push('/transactions')} accessibilityRole="button">
        <Text variant="label" color="accentPink">View your transaction history →</Text>
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
        {m.iconUrl ? <Image source={{ uri: m.iconUrl }} style={styles.image} /> : <Icon name="analytics" size={28} color="accentPink" />}
        <Text variant="bodyStrong" style={{ flex: 1 }}>{m.question}</Text>
      </View>
      <View style={styles.outcomes}>{m.outcomes.map((o, i) => (
        <View key={o.tokenId} style={[styles.outcome, { backgroundColor: i === 0 ? colors.accentPinkDim : colors.bgSurfaceAlt }]}>
          <Text variant="caption" color="textSecondary">{o.label}</Text>
          <Text variant="title" color={i === 0 ? 'accentPink' : 'textPrimary'}>{(Number(o.probability) * 100).toFixed(0)}%</Text>
        </View>
      ))}</View>
      <View style={styles.row}>
        <Text variant="caption" color="textSecondary">{m.endDate ? 'Ends ' + new Date(m.endDate).toLocaleDateString() : 'Read resolution rules'}</Text>
        <Icon name="arrow-forward" color="accentPink" size={16} />
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  hero: { gap: spacing.md, padding: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  brand: { width: 52, height: 52, borderRadius: radii.lg, backgroundColor: colors.accentPinkDim, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
  tab: { flex: 1, alignItems: 'center', padding: spacing.lg },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accentPink },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.bgSurface },
  chipActive: { backgroundColor: colors.accentPink },
  markets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  market: { width: '100%', backgroundColor: colors.bgSurface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.lg },
  image: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.bgSurfaceAlt },
  outcomes: { flexDirection: 'row', gap: spacing.sm },
  outcome: { flex: 1, padding: spacing.md, borderRadius: radii.md, gap: spacing.xs },
});
