import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { engineGet } from '@/api/client';
import { StillSettling, useRunIntent } from '@/api/intents';
import { executePrediction, predictionQuote, usePredictionAccount, type PredictionMarket } from '@/api/predictions';
import { useLiveQuote } from '@/api/use-live-quote';
import { useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
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
import { colors, radii, spacing } from '@/theme';

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
  const ready = market?.tradeable && availability?.configured && availability.serverAllowed;
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
  return <Screen>
    <BackHeader title="Your prediction" />
    {!market ? <>{loadError ? <Text color="danger">{loadError}</Text> : <ActivityIndicator color={colors.accentPink} />}</> : <>
      <View style={styles.heading}>
        {market.iconUrl ? <Image source={{ uri: market.iconUrl }} style={styles.image} /> : <Icon name="analytics" color="accentPink" size={40} />}
        <Text variant="title" style={{ flex: 1 }}>{market.question}</Text>
      </View>
      <View style={styles.row}>{market.outcomes.map((o) => (
        <Pressable key={o.tokenId} onPress={() => { setOutcome(o.tokenId); clear(); setResult(null); }}
          disabled={busy} accessibilityRole="button" accessibilityState={{ selected: outcome === o.tokenId }}
          style={[styles.choice, outcome === o.tokenId && styles.selected]}>
          <Text variant="bodyStrong" color={outcome === o.tokenId ? 'accentPink' : 'textPrimary'}>{o.label}</Text>
          <Text variant="title">{(Number(o.probability) * 100).toFixed(1)}%</Text>
          <Text variant="caption" color="textSecondary">Market probability</Text>
        </Pressable>
      ))}</View>
      <View style={styles.row}>{(['buy', 'sell'] as const).map((s) => (
        <PillButton key={s} label={s === 'buy' ? 'Buy' : 'Sell'} tone={side === s ? 'primary' : 'secondary'}
          style={{ flex: 1 }} disabled={busy} onPress={() => { setSide(s); clear(); setResult(null); }} />
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
      {quote ? <Card variant="outlined" style={styles.gap}>
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
      {!ready ? <Text color="textSecondary">{market.closed ? 'This event has closed.' : availability?.reason ?? 'Checking trading availability…'}</Text> : null}
      {result ? <Card><Text>{result}</Text><PillButton label="View activity" size="sm" tone="secondary" onPress={() => router.push('/transactions')} /></Card> : null}
      <PillButton label={(side === 'buy' ? 'Buy ' : 'Sell ') + (market.outcomes.find((o) => o.tokenId === outcome)?.label ?? 'shares')}
        loading={busy} disabled={!quote || !ready || quoting || busy} onPress={go} />
      {busy ? <Text variant="caption" color="textSecondary">{progress}</Text> : null}
      <Pressable onPress={() => setRules((v) => !v)} accessibilityRole="button" style={styles.between}>
        <Text variant="bodyStrong">How this event resolves</Text><Icon name={rules ? 'chevron-up' : 'chevron-down'} color="accentPink" />
      </Pressable>
      {rules ? <Card variant="outlined"><Text color="textSecondary">{market.description || 'Resolution rules are currently unavailable.'}</Text></Card> : null}
      <Text variant="caption" color="textSecondary">A losing prediction can become worth nothing. Only spend what you can afford to lose.</Text>
    </>}
  </Screen>;
}
const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  image: { width: 56, height: 56, borderRadius: radii.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  choice: { flex: 1, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.bgSurface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  selected: { backgroundColor: colors.accentPinkDim, borderColor: colors.accentPink },
  gap: { gap: spacing.md },
});
