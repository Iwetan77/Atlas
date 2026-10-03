import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet } from 'react-native';

import { useRunIntent } from '@/api/intents';
import { executeSend, requestSendQuote } from '@/api/send';
import { useLiveQuote } from '@/api/use-live-quote';
import { useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { ResultView } from '@/components/result-view';
import { SendReview } from '@/components/send/send-review';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { SpendableCard } from '@/components/send/spendable-card';
import { formatMoney } from '@/format/money';
import { claimUrl, keepLinkKey, newLinkKey } from '@/funding/link-key';
import { useSettings } from '@/settings/context';
import { friendlyTxError } from '@/signing/errors';
import { spacing } from '@/theme';
import { useBackToWithdraw } from '@/funding/withdraw';

const MESSAGE_MAX = 80;

type Phase = { kind: 'edit' } | { kind: 'sending' } | { kind: 'done'; url: string; amount: string } | { kind: 'failed'; message: string };

// A prefunded link: whoever opens it claims the money on a web page, no app needed.
export default function CashLinkScreen() {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const runIntent = useRunIntent();

  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });
  useBackToWithdraw(phase.kind === 'done');
  const [copied, setCopied] = useState(false);
  // One secret per link; its address is where the money waits until someone claims it.
  const [key] = useState(newLinkKey);
  const live = claimUrl(key) !== null;

  const value = Number(amount) || 0;
  const note = message.trim();

  const request = useCallback(
    () =>
      requestSendQuote(getAccessToken, {
        destination: { type: 'cashlink', escrow: key.escrow, ...(note ? { message: note } : {}) },
        amount: { amount: value.toFixed(2), currency: displayCurrency },
      }),
    [getAccessToken, key.escrow, note, value, displayCurrency],
  );
  const { quote, quoting, error, secondsLeft } = useLiveQuote(
    value > 0 && live ? request : null,
    phase.kind === 'edit',
  );

  const create = async () => {
    if (!quote) return;
    const url = claimUrl(key);
    if (!url) return;
    setPhase({ kind: 'sending' });
    try {
      // Kept on this phone before any money moves, so it can always be taken back.
      await keepLinkKey(key);
      const final = await runIntent(() => executeSend(getAccessToken, quote.quoteId));
      if (!final) setPhase({ kind: 'edit' });
      else if (final.state === 'filled') setPhase({ kind: 'done', url, amount: formatMoney(quote.receive) });
      else setPhase({ kind: 'failed', message: final.error ?? 'The link could not be created.' });
    } catch (e) {
      setPhase({ kind: 'failed', message: friendlyTxError(e) });
    }
  };

  if (phase.kind === 'done') {
    const text = `${phase.amount} for you on Atlas${note ? `: ${note}` : ''}. Claim it here: ${phase.url}`;
    return (
      <ResultView title={`Your ${phase.amount} link is ready`} subtitle="Anyone with this link can claim it. Share it only with the person it's for.">
        <Card variant="outlined">
          <Text selectable variant="caption">
            {phase.url}
          </Text>
        </Card>
        <PillButton label="Share" icon="share-outline" onPress={() => Share.share({ message: text })} />
        <PillButton
          label={copied ? 'Copied' : 'Copy link'}
          icon={copied ? 'checkmark-circle' : 'copy-outline'}
          tone={copied ? 'success' : 'secondary'}
          onPress={async () => {
            await Clipboard.setStringAsync(phase.url);
            setCopied(true);
          }}
        />
        <PillButton label="Done" tone="secondary" onPress={() => router.navigate('/')} />
      </ResultView>
    );
  }

  return (
    <Screen>
      <BackHeader title="Atlas Link" />
      <SpendableCard />
      <Text color="textSecondary">Send money with just a link. They open it and claim it, no app needed.</Text>
      <AmountInput label="Link amount" value={amount} onChange={setAmount} currency={displayCurrency} />
      <Field
        placeholder="Add a note (optional)"
        value={message}
        onChangeText={(t) => setMessage(t.slice(0, MESSAGE_MAX))}
        maxLength={MESSAGE_MAX}
        accessibilityLabel="Note for the link"
      />
      {live ? (
        <SendReview quote={quote} quoting={quoting} error={error} secondsLeft={secondsLeft} />
      ) : (
        <Text color="textSecondary">Atlas Links open on the Atlas website, which goes live soon.</Text>
      )}
      {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
      <PillButton
        label="Create link"
        icon="link-outline"
        disabled={!live || !quote || quoting}
        loading={phase.kind === 'sending'}
        onPress={create}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cta: {
    marginTop: spacing.sm,
  },
});
