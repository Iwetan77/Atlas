import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Bank } from '@/api/contract';
import { useRunIntent } from '@/api/intents';
import { executeSend, listBanks, requestSendQuote, resolveAccount } from '@/api/send';
import { useLiveQuote } from '@/api/use-live-quote';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { ResultView } from '@/components/result-view';
import { BankPicker } from '@/components/send/bank-picker';
import { SendReview } from '@/components/send/send-review';
import { BackHeader } from '@/components/ui/back-header';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/format/money';
import { useSettings } from '@/settings/context';
import { friendlyTxError } from '@/signing/errors';
import { spacing } from '@/theme';

// Nigerian account numbers (NUBAN) are exactly 10 digits.
const NUBAN_LENGTH = 10;

type Account = { state: 'idle' | 'checking' } | { state: 'ok'; name: string } | { state: 'none' | 'error'; message: string };
type Phase = { kind: 'edit' } | { kind: 'sending' } | { kind: 'done'; label: string; eta: string } | { kind: 'failed'; message: string };

// Off-ramp: from the one balance straight to a bank account, paid out by the engine through Daya.
export default function SendToBankScreen() {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const runIntent = useRunIntent();

  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  // The last name check, tagged with the bank + number it's for. Anything newer is still being checked.
  const [answer, setAnswer] = useState<{ key: string; account: Account } | null>(null);
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });

  useEffect(() => {
    listBanks(getAccessToken)
      .then(setBanks)
      .catch((e) => setBanksError(errorMessage(e)));
  }, [getAccessToken]);

  // Show the account holder's name before any money moves.
  const accountKey = bank && accountNumber.length === NUBAN_LENGTH ? `${bank.code}:${accountNumber}` : null;
  const account: Account = !accountKey ? { state: 'idle' } : answer?.key === accountKey ? answer.account : { state: 'checking' };

  useEffect(() => {
    if (!bank || !accountKey) return;
    let live = true;
    resolveAccount(getAccessToken, bank.code, accountNumber)
      .then(
        (name): Account => (name ? { state: 'ok', name } : { state: 'none', message: `No ${bank.name} account ${accountNumber}` }),
        (e): Account => ({ state: 'error', message: errorMessage(e) }),
      )
      .then((next) => live && setAnswer({ key: accountKey, account: next }));
    return () => {
      live = false;
    };
  }, [bank, accountNumber, accountKey, getAccessToken]);

  const value = Number(amount) || 0;
  const ready = !!bank && account.state === 'ok';

  const request = useCallback(
    () =>
      requestSendQuote(getAccessToken, {
        destination: { type: 'bank', bankCode: bank!.code, accountNumber },
        amount: { amount: value.toFixed(2), currency: displayCurrency },
      }),
    [getAccessToken, bank, accountNumber, value, displayCurrency],
  );
  const { quote, quoting, error, secondsLeft } = useLiveQuote(ready && value > 0 ? request : null, phase.kind === 'edit');

  const withdraw = async () => {
    if (!quote || account.state !== 'ok') return;
    setPhase({ kind: 'sending' });
    try {
      const final = await runIntent(() => executeSend(getAccessToken, quote.quoteId));
      if (!final) setPhase({ kind: 'edit' });
      else if (final.state === 'filled')
        setPhase({ kind: 'done', label: `${formatMoney(quote.receive)} is on its way to ${account.name}`, eta: quote.eta });
      else setPhase({ kind: 'failed', message: final.error ?? 'The withdrawal did not go through.' });
    } catch (e) {
      setPhase({ kind: 'failed', message: friendlyTxError(e) });
    }
  };

  if (phase.kind === 'done') {
    return (
      <ResultView title={phase.label} subtitle={`Arrives: ${phase.eta}`}>
        <PillButton label="Done" onPress={() => router.navigate('/')} />
      </ResultView>
    );
  }

  return (
    <Screen>
      <BackHeader title="Send to bank" />
      <BankPicker banks={banks} value={bank} onChange={setBank} error={banksError} />
      <Field
        prefix={<Icon name="keypad-outline" size={20} color="textSecondary" />}
        placeholder="10-digit account number"
        value={accountNumber}
        onChangeText={(t) => setAccountNumber(t.replace(/\D/g, '').slice(0, NUBAN_LENGTH))}
        keyboardType="number-pad"
        maxLength={NUBAN_LENGTH}
        accessibilityLabel="Account number"
      />
      {account.state === 'checking' ? <Text color="textSecondary">Checking account…</Text> : null}
      {account.state === 'ok' ? (
        <View style={styles.name}>
          <Icon name="checkmark-circle" size={18} color="success" />
          <Text variant="bodyStrong" color="success">
            {account.name}
          </Text>
        </View>
      ) : null}
      {account.state === 'none' || account.state === 'error' ? (
        <Text color={account.state === 'none' ? 'textSecondary' : 'danger'}>{account.message}</Text>
      ) : null}

      {ready ? (
        <>
          <AmountInput label="You send" value={amount} onChange={setAmount} currency={displayCurrency} />
          <SendReview quote={quote} quoting={quoting} error={error} secondsLeft={secondsLeft} />
          {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
          <PillButton
            label={quote ? `Withdraw ${formatMoney(quote.send)}` : 'Withdraw'}
            disabled={!quote || quoting}
            loading={phase.kind === 'sending'}
            onPress={withdraw}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
