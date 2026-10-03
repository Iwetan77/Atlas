import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { StillSettling, useRunIntent } from '@/api/intents';
import { executePrediction, predictionQuote, usePredictionAccount } from '@/api/predictions';
import { useLiveQuote } from '@/api/use-live-quote';
import { useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/format/money';
import { useSettings } from '@/settings/context';
import { friendlyTxError } from '@/signing/errors';

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
    <Text color="textSecondary">Return unused Predictions cash to your Atlas balance. Fees are included in the preview.</Text>
    <Text variant="bodyStrong">{account ? formatMoney(account.cash) + ' available' : 'Loading available cash…'}</Text>
    <AmountInput label="Cash to return" value={amount} onChange={setAmount} currency={displayCurrency}
      onMax={() => account && setAmount(account.cash.amount)} />
    {quote ? <Card><Text color="textSecondary">Back in your Atlas balance</Text>
      <Text variant="title">{formatMoney(quote.receive)}</Text>
      <Text variant="caption" color="textSecondary">{formatMoney(quote.fee)} fees included</Text></Card> : null}
    {error ? <Text color="danger">{error}</Text> : null}
    {result ? <Text>{result}</Text> : null}
    <PillButton label="Return cash" loading={busy} disabled={!quote || busy || quoting} onPress={go} />
    <PillButton label="View activity" tone="secondary" onPress={() => router.push('/transactions')} />
  </Screen>;
}
