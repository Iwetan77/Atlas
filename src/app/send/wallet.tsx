import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { WithdrawNetworks, WithdrawQuote } from '@/api/contract';
import { StillSettling, useRunIntent } from '@/api/intents';
import { useLiveQuote } from '@/api/use-live-quote';
import { executeWithdraw, listWithdrawNetworks, requestWithdrawQuote } from '@/api/withdraw';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { MoneyError } from '@/components/money-error';
import { ResultView } from '@/components/result-view';
import { SpendableCard } from '@/components/send/spendable-card';
import { TokenChainLogo } from '@/components/token-chain-logo';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { SelectSheet } from '@/components/ui/select-sheet';
import { Text } from '@/components/ui/text';
import { formatMoney, formatTokenNumber } from '@/format/money';
import { useBackToWithdraw } from '@/funding/withdraw';
import { useSettings } from '@/settings/context';
import { friendlyTxError } from '@/signing/errors';
import { colors, radii, spacing } from '@/theme';

type Phase =
  | { kind: 'edit' }
  | { kind: 'sending' }
  | { kind: 'done'; arrived: boolean; quote: WithdrawQuote }
  | { kind: 'failed'; message: string };

// "9WzDXw…AWWM": enough of an address to recognise it.
const short = (address: string) => (address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address);

// Cash out of Atlas as a coin, to any wallet: pick the coin and its network, paste the address, and
// NEAR Intents sends it there, for a 1% fee taken only once it arrives.
export default function WithdrawToWalletScreen() {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const runIntent = useRunIntent();

  const [list, setList] = useState<WithdrawNetworks | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState('solana-usdc');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });
  useBackToWithdraw(phase.kind === 'done');

  useEffect(() => {
    listWithdrawNetworks(getAccessToken).then(setList, (e) => setLoadError(errorMessage(e)));
  }, [getAccessToken]);

  const network = list?.networks.find((n) => n.id === picked);
  const to = address.trim();
  const value = Number(amount) || 0;

  const request = useCallback(
    () =>
      requestWithdrawQuote(getAccessToken, {
        networkId: picked,
        address: to,
        amount: { amount: value.toFixed(2), currency: displayCurrency },
      }),
    [getAccessToken, picked, to, value, displayCurrency],
  );
  const { quote, quoting, error, secondsLeft } = useLiveQuote(
    list?.enabled && value > 0 && to.length >= 2 ? request : null,
    phase.kind === 'edit',
  );

  const paste = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (text) setAddress(text);
  };

  const withdraw = async () => {
    if (!quote) return;
    setPhase({ kind: 'sending' });
    try {
      const final = await runIntent(() => executeWithdraw(getAccessToken, quote.quoteId));
      if (!final) setPhase({ kind: 'edit' });
      else if (final.state === 'failed') setPhase({ kind: 'failed', message: final.error ?? 'The withdrawal did not go through.' });
      else setPhase({ kind: 'done', arrived: final.state === 'filled', quote });
    } catch (e) {
      // Bitcoin and some networks take minutes: the money has left, Activity follows it.
      if (e instanceof StillSettling) setPhase({ kind: 'done', arrived: false, quote });
      else setPhase({ kind: 'failed', message: friendlyTxError(e) });
    }
  };

  if (phase.kind === 'done') {
    const q = phase.quote;
    const coins = `${formatTokenNumber(q.receive.amount)} ${q.receive.symbol}`;
    return (
      <ResultView
        title={phase.arrived ? 'Withdrawn' : 'On its way'}
        subtitle={
          phase.arrived
            ? `About ${coins} arrived at ${short(q.address)} on ${q.network}.`
            : `About ${coins} is going to ${short(q.address)} on ${q.network}. Activity shows when it arrives.`
        }>
        <PillButton label="Done" onPress={() => router.navigate('/')} />
      </ResultView>
    );
  }

  return (
    <Screen>
      <BackHeader title="Withdraw to wallet" />
      <SpendableCard />

      {!list ? (
        loadError ? (
          <MoneyError message={loadError} />
        ) : (
          <ActivityIndicator color={colors.accentPink} />
        )
      ) : !list.enabled ? (
        <Text color="textSecondary">Withdrawing to a wallet is coming soon.</Text>
      ) : (
        <>
          <SelectSheet
            title="Which coin and network?"
            value={picked}
            onChange={(id) => setPicked(id)}
            moreLabel="More coins and networks"
            items={list.networks.map((n) => ({
              key: n.id,
              label: n.label,
              detail: n.network,
              leadingNode: <TokenChainLogo symbol={n.asset} iconUrl={n.assetIcon} chainIconUrl={n.chainIcon} />,
              more: n.featured === false,
            }))}
          />
          <View style={styles.addressRow}>
            <View style={styles.addressField}>
              <Field
                placeholder={`Paste the ${network?.network ?? ''} address`}
                value={address}
                onChangeText={setAddress}
                autoCapitalize="none"
                autoCorrect={false}
                clearable
                clearLabel="Clear address"
                accessibilityLabel="Wallet address"
              />
            </View>
            <Pressable onPress={paste} accessibilityRole="button" style={({ pressed }) => [styles.paste, pressed && styles.pressed]}>
              <Text variant="label" color="accentPinkTint">
                Paste
              </Text>
            </Pressable>
          </View>
          <AmountInput label="How much?" value={amount} onChange={setAmount} currency={displayCurrency} />
          <WithdrawReview quote={quote} quoting={quoting} error={error} secondsLeft={secondsLeft} feePercent={list.feePercent} />
          {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
          <PillButton
            label="Withdraw"
            icon="arrow-up"
            disabled={!quote || quoting}
            loading={phase.kind === 'sending'}
            onPress={withdraw}
            style={styles.cta}
          />
          <Text variant="caption" color="textSecondary">
            Only paste a {network?.label ?? ''} address. Coins sent on the wrong network can&apos;t be brought back.
          </Text>
        </>
      )}
    </Screen>
  );
}

function WithdrawReview({
  quote,
  quoting,
  error,
  secondsLeft,
  feePercent,
}: {
  quote: WithdrawQuote | null;
  quoting: boolean;
  error: string | null;
  secondsLeft: number;
  feePercent: string;
}) {
  if (quote) {
    const minutes = quote.timeEstimateSec ? Math.max(1, Math.round(quote.timeEstimateSec / 60)) : null;
    return (
      <Card variant="outlined" style={styles.review}>
        <Row label="To" value={short(quote.address)} />
        <Row label="They get about" value={`${formatTokenNumber(quote.receive.amount)} ${quote.receive.symbol}`} strong />
        <Row label={`Fee (${feePercent}%)`} value={formatMoney(quote.fee)} />
        {Number(quote.networkFee.amount) > 0 ? <Row label="Network fee" value={formatMoney(quote.networkFee)} /> : null}
        {minutes ? <Row label="Arrives" value={`In about ${minutes} min`} /> : null}
        <Text variant="caption" color="textSecondary">
          {quoting ? 'Updating…' : `Held for ${secondsLeft}s`}
        </Text>
      </Card>
    );
  }
  if (quoting) {
    return (
      <View style={styles.busy}>
        <ActivityIndicator color={colors.accentPink} />
        <Text color="textSecondary">Working out the details…</Text>
      </View>
    );
  }
  if (error) return <MoneyError message={error} />;
  return null;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text color="textSecondary">{label}</Text>
      <Text variant={strong ? 'heading' : 'bodyStrong'} style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addressField: {
    flex: 1,
  },
  paste: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkMuted,
  },
  pressed: {
    opacity: 0.8,
  },
  review: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
  busy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cta: {
    marginTop: spacing.sm,
  },
});
