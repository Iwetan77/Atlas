import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { engineGet } from '@/api/client';
import { StillSettling, useRunIntent } from '@/api/intents';
import { executePrediction, predictionQuote, usePredictionAccount, type PredictionMarket } from '@/api/predictions';
import { useLiveQuote } from '@/api/use-live-quote';
import { useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { ProbabilityChart } from '@/components/predictions/probability-chart';
import { MarketArt } from '@/components/predictions/market-art';
import { MarketComments } from '@/components/predictions/comments';
import { endsLabel, percent, volumeLabel } from '@/components/predictions/market-card';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/format/money';
import { useSettings } from '@/settings/context';
import { friendlyTxError } from '@/signing/errors';
import { colors, radii, spacing, themedStyles } from '@/theme';

export default function PredictionDetail() {
  const { marketId, tokenId } = useLocalSearchParams<{ marketId: string; tokenId?: string }>();
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const { account, availability, reload } = usePredictionAccount(displayCurrency);
  const [market, setMarket] = useState<PredictionMarket | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState(tokenId ?? '');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [shares, setShares] = useState('');
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const runIntent = useRunIntent();
  useEffect(() => {
    let active = true;
    getAccessToken().then((token) => engineGet<PredictionMarket>('/v1/predictions/markets/' + encodeURIComponent(marketId), token))
      .then((m) => { if (active) { setMarket(m); setOutcome((old) => old || m.outcomes[0].tokenId); setLoadError(null); } },
        (e) => { if (active) setLoadError(e instanceof Error ? e.message : 'Market could not load.'); });
    return () => { active = false; };
  }, [getAccessToken, marketId]);
  const holding = account?.positions.find((p) => p.tokenId === outcome);
  const request = useCallback(() => predictionQuote(getAccessToken, {
    marketId, tokenId: outcome, side, amount: { amount: side === 'buy' ? amount : holding?.value.amount ?? '0', currency: displayCurrency },
    ...(side === 'sell' ? { shares } : {}),
  }), [getAccessToken, marketId, outcome, side, amount, displayCurrency, shares, holding?.value.amount]);
  const ready = market?.tradeable && availability?.configured && availability.deviceSubmission && availability.deviceAllowed;
  const { quote, quoting, error, clear } = useLiveQuote(
    ready && outcome && (side === 'buy' ? Number(amount) > 0 : Number(shares) > 0) ? request : null, !busy);
  const go = async () => {
    if (!quote) return;
    setBusy(true); setResult(null); setProgress('Preparing your prediction');
    try {
      const final = await runIntent(() => executePrediction(getAccessToken, quote.quoteId), undefined, (s) => {
        setProgress(s.stage === 'fund' ? 'Moving your cash · keep Atlas open' :
          s.stage === 'sign' ? 'Your phone is approving the next step' : 'Confirming your prediction');
      });
      if (final?.state === 'filled') {
        setResult(side === 'buy' ? 'Your prediction is open.' : 'Sold. The proceeds are in Predictions cash.');
        reload(); clear(); setAmount(''); setShares('');
      } else if (final) setResult(final.error ?? 'That did not settle. Check Activity.');
    } catch (e) { setResult(e instanceof StillSettling ? 'Still processing. Check Activity; keep Atlas open to finish the next step.' : friendlyTxError(e)); }
    finally { setBusy(false); setProgress(''); }
  };
  return <Screen stickyTitle={market?.question ?? 'Prediction'}>
    <BackHeader title="Prediction" />
    {!market ? <>{loadError ? <Text color="danger">{loadError}</Text> : <ActivityIndicator color={colors.accentPink} />}</> : <>
      <View style={styles.marketHeading}>
        <MarketArt uri={market.iconUrl} question={market.question} size={56} />
        <View style={styles.headingText}>
          <Text variant="heading">{market.question}</Text>
          <View style={styles.metaRow}>
            {endsLabel(market.endDate) ? <View style={styles.meta}><Icon name="calendar-outline" size={13} color="textSecondary" /><Text variant="caption" color="textSecondary">{endsLabel(market.endDate)}</Text></View> : null}
            {volumeLabel(market.volumeUsd) ? <View style={styles.meta}><Icon name="bar-chart-outline" size={13} color="textSecondary" /><Text variant="caption" color="textSecondary">{volumeLabel(market.volumeUsd)}</Text></View> : null}
          </View>
        </View>
      </View>
      <ProbabilityChart marketId={market.marketId} />
      <Text variant="label" color="textSecondary">Pick your outcome</Text>
      <View style={styles.choices}>{market.outcomes.map((o, i) => {
        const on = outcome === o.tokenId;
        return (
          <Pressable key={o.tokenId} onPress={() => { setOutcome(o.tokenId); clear(); setResult(null); }}
            disabled={busy} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={[styles.choice, on && styles.selected]}>
            <View style={styles.between}>
              <Text variant="bodyStrong" color={on ? 'accentPinkTint' : 'textPrimary'} numberOfLines={1} style={styles.choiceLabel}>{o.label}</Text>
              <View style={[styles.radio, on && styles.radioSelected]}>{on ? <Icon name="checkmark" size={12} color="tilePinkInk" /> : null}</View>
            </View>
            <Text variant="title" style={styles.probability}>{percent(o.probability)}</Text>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(2, Math.min(100, Number(o.probability) * 100))}%`, backgroundColor: i === 0 ? colors.accentPinkTint : colors.tileBlue }]} /></View>
            <Text variant="caption" color="textSecondary">chance, by the market</Text>
          </Pressable>
        );
      })}</View>
      <View style={styles.tabs}>{(['buy', 'sell'] as const).map((s) => (
        <Pressable key={s} accessibilityRole="tab" accessibilityState={{ selected: side === s }}
          style={[styles.tab, side === s && styles.tabActive]} disabled={busy} onPress={() => { setSide(s); clear(); setResult(null); }}>
          <Text variant="bodyStrong" color={side === s ? 'accentPinkTint' : 'textSecondary'}>{s === 'buy' ? 'Buy shares' : 'Sell shares'}</Text>
        </Pressable>
      ))}</View>
      {side === 'buy' ? <AmountInput label="You spend" value={amount} onChange={setAmount} currency={displayCurrency} /> : (
        <Card style={styles.gap}>
          <Text variant="label" color="textSecondary">Shares to sell</Text>
          <Field value={shares} onChangeText={(s) => setShares(s.replace(/[^0-9.]/g, ''))} placeholder="0"
            keyboardType="decimal-pad" accessibilityLabel="Prediction shares to sell" />
          <View style={styles.between}><Text variant="caption" color="textSecondary">{holding?.shares ?? '0'} shares held</Text>
            <PillButton label="Max" size="sm" tone="secondary" disabled={!holding || busy}
              onPress={() => setShares((Math.floor(Number(holding?.shares ?? 0) * 100) / 100).toFixed(2))} /></View>
        </Card>
      )}
      {quote ? <Card style={styles.preview}>
        <View style={styles.between}><Text color="textSecondary">{side === 'buy' ? 'You pay' : 'You receive'}</Text>
          <Text variant="bodyStrong">{formatMoney(side === 'buy' ? quote.pay : quote.receive)}</Text></View>
        <View style={styles.between}><Text color="textSecondary">Shares</Text><Text variant="bodyStrong">{(Number(quote.shares) / 1_000_000).toFixed(2)}</Text></View>
        {quote.potentialPayout ? <View style={styles.between}><Text color="textSecondary">If your choice wins</Text>
          <Text variant="bodyStrong" color="success">{formatMoney(quote.potentialPayout)}</Text></View> : null}
        <View style={styles.between}><Text color="textSecondary">Fees included</Text><Text>{formatMoney(quote.fee)}</Text></View>
        {Number(quote.gasReserve.amount) > 0 ? <View style={styles.between}><Text color="textSecondary">Network fee reserve included</Text><Text>{formatMoney(quote.gasReserve)}</Text></View> : null}
        <Text variant="caption" color="textSecondary">All shares or none. Your payout depends on the event&apos;s resolution rules.</Text>
      </Card> : null}
      {quoting ? <ActivityIndicator color={colors.accentPink} /> : null}
      {error ? <Text color="danger">{error}</Text> : null}
      {!ready ? <View style={styles.notice}><Icon name="information-circle-outline" size={20} color="accentPinkTint" /><Text variant="caption" color="textSecondary" style={{ flex: 1 }}>{market.closed ? 'This event has closed.' : availability?.reason ?? 'Checking trading availability…'}</Text></View> : null}
      {result ? <Card><Text>{result}</Text><PillButton label="View activity" size="sm" tone="secondary" onPress={() => router.push('/transactions')} /></Card> : null}
      <PillButton label={(side === 'buy' ? 'Buy ' : 'Sell ') + (market.outcomes.find((o) => o.tokenId === outcome)?.label ?? 'shares')}
        loading={busy} disabled={!quote || !ready || quoting || busy} onPress={go} />
      {busy ? <Text variant="caption" color="textSecondary">{progress}</Text> : null}
      <Pressable onPress={() => setRules((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: rules }} style={styles.rules}>
        <Text variant="bodyStrong">How this event resolves</Text><Icon name={rules ? 'chevron-up' : 'chevron-down'} color="accentPink" />
      </Pressable>
      {rules ? <Card variant="outlined"><Text color="textSecondary">{market.description || 'Resolution rules are currently unavailable.'}</Text></Card> : null}
      <View style={styles.risk}><Icon name="shield-outline" size={15} color="textSecondary" /><Text variant="caption" color="textSecondary" style={{ flex: 1 }}>A losing prediction can become worth nothing. Only spend what you can afford to lose.</Text></View>
      <MarketComments marketId={market.marketId} />
    </>}
  </Screen>;
}
const styles = themedStyles(() => ({
  marketHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.bgSurface },
  headingText: { flex: 1, gap: spacing.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  choiceLabel: { flexShrink: 1 },
  track: { height: 4, borderRadius: radii.pill, overflow: 'hidden', backgroundColor: colors.bgTabBar },
  fill: { height: '100%', borderRadius: radii.pill },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  choice: { flex: 1, minWidth: 140, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.bgSurface, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.bgSurface },
  selected: { backgroundColor: colors.accentPinkMuted, borderColor: colors.accentPinkTint },
  radio: { width: 20, height: 20, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.textDisabled, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: colors.tilePink, borderColor: colors.tilePink },
  probability: { fontSize: 32, lineHeight: 38 },
  tabs: { flexDirection: 'row', gap: spacing.xs, padding: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.bgTabBar },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radii.pill },
  tabActive: { backgroundColor: colors.bgSurface },
  gap: { gap: spacing.md },
  preview: { gap: spacing.md, backgroundColor: colors.bgTabBar },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radii.md, backgroundColor: colors.bgSurface, padding: spacing.lg },
  rules: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  risk: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
}));
