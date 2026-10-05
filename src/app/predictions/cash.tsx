import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { StillSettling, useRunIntent } from '@/api/intents';
import { executePrediction, predictionQuote, usePredictionAccount } from '@/api/predictions';
import { useLiveQuote } from '@/api/use-live-quote';
import { useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/format/money';
import { useSettings } from '@/settings/context';
import { friendlyTxError } from '@/signing/errors';
import { colors, radii, spacing, themedStyles } from '@/theme';

export default function PredictionCash() {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const { account, reload } = usePredictionAccount(displayCurrency);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const runIntent = useRunIntent();
  const request = useCallback(() => predictionQuote(getAccessToken, {
    side: 'withdraw', amount: { amount, currency: displayCurrency },
  }), [getAccessToken, amount, displayCurrency]);
  const { quote, quoting, error } = useLiveQuote(Number(amount) > 0 ? request : null, !busy);
  const go = async () => {
    if (!quote) return;
    setBusy(true); setResult(null);
    try {
      const final = await runIntent(() => executePrediction(getAccessToken, quote.quoteId));
      if (final?.state === 'filled') { setResult('Your cash is back in Atlas.'); reload(); setAmount(''); }
      else if (final) setResult(final.error ?? 'Check Activity for this cash return.');
    } catch (e) { setResult(e instanceof StillSettling ? 'Your cash return is still processing. Follow it in Activity.' : friendlyTxError(e)); }
    finally { setBusy(false); }
  };
  return <Screen>
    <BackHeader title="Return your cash" />
    <Card style={styles.cashCard}>
      <View style={styles.top}><View style={styles.icon}><Icon name="wallet-outline" size={22} color="accentPinkTint" /></View><Text variant="overline" color="textSecondary">Predictions cash</Text></View>
      <Text variant="title" style={styles.balance}>{account ? formatMoney(account.cash) : '—'}</Text>
      <Text variant="caption" color="textSecondary">{account ? 'Available to return to your Atlas balance' : 'Loading available cash…'}</Text>
    </Card>
    <Text color="textSecondary">Return unused Predictions cash to your Atlas balance. What you type is what lands: the small fee comes from your Predictions cash on top, or out of it when you return everything.</Text>
    <AmountInput label="Cash to return" value={amount} onChange={setAmount} currency={displayCurrency}
      onMax={() => account && setAmount(account.cash.amount)} />
    {quote ? <Card style={styles.preview}><View style={styles.top}><Icon name="arrow-down-circle-outline" size={20} color="accentPinkTint" /><Text color="textSecondary">Back in your Atlas balance</Text></View>
      <Text variant="title">{formatMoney(quote.receive)}</Text>
      <Text variant="caption" color="textSecondary">
        {/* More leaves Predictions cash than was typed: the fee went on top. */}
        {Number(quote.pay.amount) - (Number(amount) || 0) > 0.005
          ? `${formatMoney(quote.fee)} fee, taken from your Predictions cash on top`
          : `${formatMoney(quote.fee)} fee included`}
      </Text></Card> : null}
    {error ? <Text color="danger">{error}</Text> : null}
    {result ? <Card variant="outlined"><Text>{result}</Text></Card> : null}
    <PillButton label="Return cash" loading={busy} disabled={!quote || busy || quoting} onPress={go} />
    <PillButton label="View activity" tone="secondary" onPress={() => router.push('/transactions')} />
  </Screen>;
}
const styles = themedStyles(() => ({
  cashCard: { gap: spacing.md, backgroundColor: colors.bgTabBar, borderWidth: 1, borderColor: colors.border },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.accentPinkMuted, alignItems: 'center', justifyContent: 'center' },
  balance: { fontSize: 36, lineHeight: 42 },
  preview: { gap: spacing.md },
}));
