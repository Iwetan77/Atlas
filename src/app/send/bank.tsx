import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { Bank, BankGuess, BankRecipient } from '@/api/contract';
import { useRunIntent } from '@/api/intents';
import { executeSend, guessBanks, listBanks, listRecipients, requestSendQuote, resolveAccount, setFavorite } from '@/api/send';
import { useLiveQuote } from '@/api/use-live-quote';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { BankLogo, BankPicker } from '@/components/send/bank-picker';
import { SendReview } from '@/components/send/send-review';
import { type DoneTransfer, TransferDone } from '@/components/send/transfer-done';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { SpendableCard } from '@/components/send/spendable-card';
import { formatMoney } from '@/format/money';
import { friendlyTxError } from '@/signing/errors';
import { colors, radii, spacing } from '@/theme';
import { useBackToWithdraw } from '@/funding/withdraw';

// Nigerian account numbers (NUBAN) are exactly 10 digits.
const NUBAN_LENGTH = 10;

// Who the money goes to, once the bank has confirmed the holder's name.
type Payee = { bank: Bank; accountNumber: string; accountName: string };
type Guesses = { number: string; banks: BankGuess[] | null; error: string | null };
type Phase = { kind: 'edit' } | { kind: 'sending' } | { kind: 'done'; transfer: DoneTransfer } | { kind: 'failed'; message: string };

// Off-ramp: from the one balance straight to a bank account, paid out by the engine.
// Type the account number and Atlas finds the bank (or pick a recent or favorite); then the amount.
export default function SendToBankScreen() {
  const { getAccessToken } = useAtlasAuth();
  const runIntent = useRunIntent();
  // From the scanner: an account number, and the bank when the scan named one.
  const params = useLocalSearchParams<{ account?: string; bank?: string }>();

  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<BankRecipient[] | null>(null);
  const [tab, setTab] = useState<'recents' | 'favorites'>('recents');
  const [accountNumber, setAccountNumber] = useState(() => (params.account ?? '').replace(/\D/g, '').slice(0, NUBAN_LENGTH));
  const [guesses, setGuesses] = useState<Guesses | null>(null);
  const [manual, setManual] = useState<{ bank: Bank; result: string | null } | null>(null);
  const [payee, setPayee] = useState<Payee | null>(null);
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });
  useBackToWithdraw(phase.kind === 'done');

  useEffect(() => {
    listBanks(getAccessToken)
      .then(setBanks)
      .catch((e) => setBanksError(errorMessage(e)));
  }, [getAccessToken]);

  // Refresh on return; matching the loaded recents stays instant while typing.
  useFocusEffect(useCallback(() => {
    let live = true;
    listRecipients(getAccessToken).then(
      (next) => { if (live) setRecipients(next); },
      () => { if (live) setRecipients((previous) => previous ?? []); },
    );
    return () => { live = false; };
  }, [getAccessToken]));

  // Ten digits: find which banks this account is at (each confirmed with the holder's name).
  const complete = accountNumber.length === NUBAN_LENGTH;
  useEffect(() => {
    if (!complete || payee) return;
    let live = true;
    guessBanks(getAccessToken, accountNumber).then(
      (found) => live && setGuesses({ number: accountNumber, banks: found, error: null }),
      (e) => live && setGuesses({ number: accountNumber, banks: [], error: errorMessage(e) }),
    );
    return () => {
      live = false;
    };
  }, [complete, accountNumber, payee, getAccessToken]);
  const found = guesses?.number === accountNumber ? guesses : null;

  // A scan that named the bank counts as choosing it, until the number is edited.
  const [scanned, setScanned] = useState(!!params.bank);
  const scannedBank = scanned && params.bank && banks ? banks.find((b) => b.code === params.bank) ?? null : null;
  const chosen = useMemo(
    () => manual ?? (scannedBank && complete ? { bank: scannedBank, result: null } : null),
    [manual, scannedBank, complete],
  );

  // A bank chosen by hand (or by the scan): check the holder's name there.
  useEffect(() => {
    if (!chosen || chosen.result !== null || !complete) return;
    let live = true;
    resolveAccount(getAccessToken, chosen.bank.code, accountNumber).then(
      (name) => {
        if (!live) return;
        if (name) setPayee({ bank: chosen.bank, accountNumber, accountName: name });
        else setManual({ ...chosen, result: `No ${chosen.bank.name} account ${accountNumber}` });
      },
      (e) => live && setManual({ ...chosen, result: errorMessage(e) }),
    );
    return () => {
      live = false;
    };
  }, [chosen, complete, accountNumber, getAccessToken]);

  const value = Number(amount) || 0;
  const request = useCallback(
    () =>
      requestSendQuote(getAccessToken, {
        destination: { type: 'bank', bankCode: payee!.bank.code, accountNumber: payee!.accountNumber },
        // What the bank gets, in naira; the fee is added on top.
        amount: { amount: value.toFixed(2), currency: 'NGN' },
      }),
    [getAccessToken, payee, value],
  );
  const { quote, quoting, error, secondsLeft } = useLiveQuote(payee && value > 0 ? request : null, phase.kind === 'edit');

  const favorite = payee
    ? !!recipients?.find((r) => r.bankCode === payee.bank.code && r.accountNumber === payee.accountNumber)?.favorite
    : false;
  const toggleFavorite = () => {
    if (!payee) return;
    setFavorite(getAccessToken, payee.bank.code, payee.accountNumber, !favorite).then(setRecipients, () => {});
  };

  const choose = (next: Payee) => {
    setAccountNumber(next.accountNumber);
    setPayee(next);
  };
  const reset = () => {
    setPayee(null);
    setManual(null);
    setScanned(false);
    setGuesses(null);
    setAmount('');
  };

  const withdraw = async () => {
    if (!quote || !payee) return;
    setPhase({ kind: 'sending' });
    try {
      const final = await runIntent(() => executeSend(getAccessToken, quote.quoteId));
      if (!final) setPhase({ kind: 'edit' });
      else if (final.state === 'filled')
        setPhase({
          kind: 'done',
          transfer: {
            intentId: final.intentId,
            bank: payee.bank,
            accountNumber: payee.accountNumber,
            accountName: payee.accountName,
            receive: quote.receive,
            send: quote.send,
            fee: quote.fee,
            eta: quote.eta,
          },
        });
      else setPhase({ kind: 'failed', message: final.error ?? 'The withdrawal did not go through.' });
    } catch (e) {
      setPhase({ kind: 'failed', message: friendlyTxError(e) });
    }
  };

  if (phase.kind === 'done') {
    return (
      <TransferDone
        transfer={phase.transfer}
        favorite={favorite}
        onFavorite={toggleFavorite}
        onAnother={() => {
          reset();
          setAccountNumber('');
          setPhase({ kind: 'edit' });
          listRecipients(getAccessToken).then(setRecipients, () => {});
        }}
      />
    );
  }

  if (payee) {
    return (
      <Screen>
        <BackHeader title="Send to bank" />
        <SpendableCard />
        <Card style={styles.payee}>
          <BankLogo bank={payee.bank} size={40} />
          <View style={styles.payeeText}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {payee.accountName}
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {payee.bank.name} · {payee.accountNumber}
            </Text>
          </View>
          <Pressable
            onPress={toggleFavorite}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={favorite ? 'Remove from favorites' : 'Save to favorites'}>
            <Icon name={favorite ? 'star' : 'star-outline'} size={22} color={favorite ? 'accentPink' : 'textSecondary'} />
          </Pressable>
        </Card>
        <Pressable onPress={reset} hitSlop={8} accessibilityRole="button">
          <Text variant="label" color="accentPinkTint">
            Change account
          </Text>
        </Pressable>
        <AmountInput label="They get" value={amount} onChange={setAmount} currency="NGN" />
        <SendReview quote={quote} quoting={quoting} error={error} secondsLeft={secondsLeft} />
        {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
        <PillButton
          label={quote ? `Withdraw ${formatMoney(quote.send)}` : 'Withdraw'}
          disabled={!quote || quoting}
          loading={phase.kind === 'sending'}
          onPress={withdraw}
        />
      </Screen>
    );
  }

  const shown = (recipients ?? []).filter((r) => (tab === 'favorites' ? r.favorite : r.lastUsedAtUnixMs > 0));
  const matches = accountNumber
    ? (recipients ?? [])
      .filter((r) => (r.lastUsedAtUnixMs > 0 || r.favorite) && r.accountNumber.startsWith(accountNumber))
      .sort((a, b) => b.lastUsedAtUnixMs - a.lastUsedAtUnixMs)
      .slice(0, 5)
    : [];

  return (
    <Screen>
      <BackHeader title="Send to bank" />
      <SpendableCard />
      <Field
        prefix={<Icon name="keypad-outline" size={20} color="textSecondary" />}
        placeholder="10-digit account number"
        value={accountNumber}
        onChangeText={(t) => {
          setAccountNumber(t.replace(/\D/g, '').slice(0, NUBAN_LENGTH));
          setManual(null);
          setScanned(false);
        }}
        keyboardType="number-pad"
        maxLength={NUBAN_LENGTH}
        accessibilityLabel="Account number"
      />

      {matches.length > 0 ? (
        <View style={styles.suggestions}>
          <View style={styles.suggestionHeading}>
            <Icon name="time-outline" size={16} color="accentPinkTint" />
            <Text variant="label" color="accentPinkTint">Sent here before</Text>
            <Text variant="caption" color="textSecondary">Tap to choose</Text>
          </View>
          <Card style={styles.list}>
            {matches.map((r, i) => {
              const bank = { code: r.bankCode, name: r.bankName, logo: r.logo };
              return (
                <Row
                  key={`${r.bankCode}:${r.accountNumber}`}
                  bank={bank}
                  title={r.accountName}
                  subtitle={`${r.bankName} · ${r.accountNumber}`}
                  divider={i > 0}
                  onPress={() => choose({ bank, accountNumber: r.accountNumber, accountName: r.accountName })}
                />
              );
            })}
          </Card>
        </View>
      ) : null}

      {complete ? (
        <>
          {!found ? (
            <View style={styles.finding}>
              <ActivityIndicator color={colors.accentPink} />
              <Text color="textSecondary">Finding the bank…</Text>
            </View>
          ) : found.banks?.length ? (
            <Card style={styles.list}>
              {found.banks.map((b, i) => (
                <Row
                  key={b.code}
                  bank={b}
                  title={b.accountName}
                  subtitle={b.name}
                  divider={i > 0}
                  onPress={() => choose({ bank: b, accountNumber, accountName: b.accountName })}
                />
              ))}
            </Card>
          ) : (
            <Text color="textSecondary">{found.error ?? 'We couldn’t find this account at the usual banks. Choose the bank below.'}</Text>
          )}
          <Text variant="label" color="textSecondary">
            Not there? Choose the bank
          </Text>
          <BankPicker
            banks={banks}
            value={chosen?.bank ?? null}
            onChange={(bank) => setManual({ bank, result: null })}
            error={banksError}
          />
          {chosen && chosen.result === null ? <Text color="textSecondary">Checking account…</Text> : null}
          {chosen?.result ? <Text color="textSecondary">{chosen.result}</Text> : null}
        </>
      ) : !accountNumber ? (
        <>
          <View style={styles.tabs}>
            {(['recents', 'favorites'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t }}
                style={[styles.tab, tab === t && styles.tabOn]}>
                <Text variant="label" color={tab === t ? 'textPrimary' : 'textSecondary'}>
                  {t === 'recents' ? 'Recents' : 'Favorites'}
                </Text>
              </Pressable>
            ))}
          </View>
          {recipients === null ? (
            <ActivityIndicator color={colors.accentPink} />
          ) : shown.length === 0 ? (
            <Text color="textSecondary">
              {tab === 'favorites'
                ? 'Tap the star on an account to keep it here.'
                : 'Accounts you send to show up here.'}
            </Text>
          ) : (
            <Card style={styles.list}>
              {shown.map((r, i) => {
                const bank = { code: r.bankCode, name: r.bankName, logo: r.logo };
                return (
                  <Row
                    key={`${r.bankCode}:${r.accountNumber}`}
                    bank={bank}
                    title={r.accountName}
                    subtitle={`${r.bankName} · ${r.accountNumber}`}
                    divider={i > 0}
                    onPress={() => choose({ bank, accountNumber: r.accountNumber, accountName: r.accountName })}
                  />
                );
              })}
            </Card>
          )}
        </>
      ) : recipients === null ? (
        <ActivityIndicator color={colors.accentPink} />
      ) : matches.length === 0 ? (
        <Text variant="caption" color="textSecondary">
          No recent account starts with {accountNumber}. Keep typing the 10-digit account number.
        </Text>
      ) : null}
    </Screen>
  );
}

function Row({
  bank,
  title,
  subtitle,
  divider,
  onPress,
}: {
  bank: Bank;
  title: string;
  subtitle: string;
  divider: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}>
      <BankLogo bank={bank} size={36} />
      <View style={styles.payeeText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Icon name="chevron-forward" size={16} color="textSecondary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  payee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  payeeText: {
    flex: 1,
    gap: spacing.xxs,
  },
  finding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  list: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  suggestions: {
    gap: spacing.sm,
  },
  suggestionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  tabOn: {
    backgroundColor: colors.bgSurface,
  },
});
