import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import type { Recipient } from '@/api/contract';
import { useRunIntent } from '@/api/intents';
import { executeSend, HANDLE_RE, normaliseHandle, requestSendQuote, resolveHandle } from '@/api/send';
import { useLiveQuote } from '@/api/use-live-quote';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { ProfileAvatar } from '@/components/profile-avatar';
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
import { useSettings } from '@/settings/context';
import { friendlyTxError } from '@/signing/errors';
import { spacing, themedStyles } from '@/theme';
import { useBackToWithdraw } from '@/funding/withdraw';

type Lookup = { state: 'idle' | 'looking' } | { state: 'found'; recipient: Recipient } | { state: 'none' | 'error'; message: string };
type Phase = { kind: 'edit' } | { kind: 'sending' } | { kind: 'done'; label: string } | { kind: 'failed'; message: string };

export default function SendToFriendScreen() {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const runIntent = useRunIntent();

  const [raw, setRaw] = useState('');
  // The last lookup, tagged with the handle it's for. Anything newer is still being looked up.
  const [answer, setAnswer] = useState<{ handle: string; lookup: Lookup } | null>(null);
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });
  useBackToWithdraw(phase.kind === 'done');

  const handle = normaliseHandle(raw);
  const valid = HANDLE_RE.test(handle);
  const lookup: Lookup = !valid ? { state: 'idle' } : answer?.handle === handle ? answer.lookup : { state: 'looking' };
  const recipient = lookup.state === 'found' ? lookup.recipient : null;
  const value = Number(amount) || 0;

  // Look the handle up once typing pauses.
  useEffect(() => {
    if (!valid) return;
    let live = true;
    const id = setTimeout(async () => {
      let next: Lookup;
      try {
        const found = await resolveHandle(getAccessToken, handle);
        next = found ? { state: 'found', recipient: found } : { state: 'none', message: `No one on Atlas is @${handle}` };
      } catch (e) {
        next = { state: 'error', message: errorMessage(e) };
      }
      if (live) setAnswer({ handle, lookup: next });
    }, 400);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [handle, valid, getAccessToken]);

  const request = useCallback(
    () =>
      requestSendQuote(getAccessToken, {
        destination: { type: 'atlas', handle },
        amount: { amount: value.toFixed(2), currency: displayCurrency },
      }),
    [getAccessToken, handle, value, displayCurrency],
  );
  const { quote, quoting, error, secondsLeft, reload } = useLiveQuote(
    recipient && value > 0 ? request : null,
    phase.kind === 'edit',
  );

  const send = async () => {
    if (!quote || !recipient) return;
    setPhase({ kind: 'sending' });
    try {
      const final = await runIntent(() => executeSend(getAccessToken, quote.quoteId));
      if (!final) setPhase({ kind: 'edit' });
      else if (final.state === 'filled')
        setPhase({ kind: 'done', label: `${formatMoney(quote.receive)} sent to @${recipient.handle}` });
      else setPhase({ kind: 'failed', message: final.error ?? 'The send did not go through.' });
    } catch (e) {
      setPhase({ kind: 'failed', message: friendlyTxError(e) });
    }
  };

  if (phase.kind === 'done') {
    return (
      <ResultView title={phase.label} subtitle="It's already in their Atlas balance.">
        <PillButton label="Done" onPress={() => router.navigate('/')} />
      </ResultView>
    );
  }

  return (
    <Screen>
      <BackHeader title="Atlas Friends" />
      <SpendableCard />
      <Field
        prefix="@"
        placeholder="their handle"
        value={raw}
        onChangeText={setRaw}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        accessibilityLabel="Friend's Atlas handle"
      />

      {recipient ? (
        <Card style={styles.recipient}>
          <ProfileAvatar photo={recipient.avatar} initial={(recipient.displayName || recipient.handle)[0].toUpperCase()}
            label={'Profile photo of @' + recipient.handle} size={44} />
          <View style={styles.recipientText}>
            <Text variant="bodyStrong">{recipient.displayName ?? `@${recipient.handle}`}</Text>
            <Text variant="caption" color="textSecondary">
              @{recipient.handle}
            </Text>
          </View>
        </Card>
      ) : lookup.state === 'looking' ? (
        <Text color="textSecondary">Looking up @{handle}…</Text>
      ) : lookup.state === 'none' || lookup.state === 'error' ? (
        <Text color={lookup.state === 'none' ? 'textSecondary' : 'danger'}>{lookup.message}</Text>
      ) : raw && !HANDLE_RE.test(handle) ? (
        <Text variant="caption" color="textSecondary">
          Handles are 3–20 letters, numbers or underscores.
        </Text>
      ) : null}

      {recipient ? (
        <>
          <AmountInput label="You send" value={amount} onChange={setAmount} currency={displayCurrency} />
          <SendReview quote={quote} quoting={quoting} error={error} secondsLeft={secondsLeft} onReload={phase.kind === 'edit' ? reload : undefined} />
          {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
          <PillButton
            label={`Send to @${recipient.handle}`}
            disabled={!quote || quoting}
            loading={phase.kind === 'sending'}
            onPress={send}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  recipient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  recipientText: {
    flex: 1,
    gap: spacing.xxs,
  },
}));
