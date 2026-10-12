import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useBalance } from '@/api/balance';
import type { Money, MoveDirection, MoveQuote } from '@/api/contract';
import { StillSettling, useRunIntent } from '@/api/intents';
import { executeMove, requestMoveQuote } from '@/api/moves';
import { spendableAmount, tradingAmount } from '@/api/pockets';
import { useLiveQuote } from '@/api/use-live-quote';
import { useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { MoneyError } from '@/components/money-error';
import { QuoteTimer } from '@/components/quote-timer';
import { ResultView } from '@/components/result-view';
import { BackHeader, goBack } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney, hiddenMoney } from '@/format/money';
import { useAddMoney } from '@/funding/add-money';
import { useWithdraw } from '@/funding/withdraw';
import { useSettings } from '@/settings/context';
import { friendlyTxError } from '@/signing/errors';
import { colors, radii, spacing, themedStyles } from '@/theme';

type Phase =
  | { kind: 'edit' }
  | { kind: 'preparing' }
  | { kind: 'settling' }
  | { kind: 'done'; quote: MoveQuote }
  | { kind: 'failed'; message: string };

const POCKETS: Record<'spendable' | 'trading', { name: string; icon: IconName; uses: string }> = {
  spendable: { name: 'Spendable', icon: 'wallet-outline', uses: 'Send, cash out, save' },
  trading: { name: 'Trading', icon: 'trending-up', uses: 'Trade, perps, predictions' },
};

// Moving cash between the user's own two balances: Spendable (sends, cash-outs, savings) and Trading
// (trades, perps, predictions). One amount, the fee on top, one confirm, a few seconds.
export default function MoveScreen() {
  const params = useLocalSearchParams<{ direction?: string; amount?: string }>();
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency, stealthMode } = useSettings();
  const balance = useBalance();
  const runIntent = useRunIntent();
  const addMoney = useAddMoney();
  const withdraw = useWithdraw();
  const [direction, setDirection] = useState<MoveDirection>(params.direction === 'to_spendable' ? 'to_spendable' : 'to_trading');
  const [amount, setAmount] = useState(() => (Number(params.amount) > 0 ? Number(params.amount).toFixed(2) : ''));
  // Max: everything in the balance it leaves; the engine takes the fee out of it.
  const [all, setAll] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });

  const data = balance.data;
  const spendable = data ? spendableAmount(data) : null;
  const trading = data ? tradingAmount(data) : null;
  const from = direction === 'to_trading' ? 'spendable' : 'trading';
  const to = direction === 'to_trading' ? 'trading' : 'spendable';
  const available = from === 'spendable' ? spendable : trading;
  const value = Number(amount) || 0;
  const show = (n: number | null) =>
    n === null ? '…' : stealthMode ? hiddenMoney(displayCurrency) : formatMoney({ amount: n.toFixed(2), currency: displayCurrency });

  const showMoney = (money: Money) => stealthMode ? hiddenMoney(money.currency) : formatMoney(money);

  const request = useCallback(
    () =>
      requestMoveQuote(getAccessToken, {
        direction,
        amount: { amount: value.toFixed(2), currency: displayCurrency },
        ...(all ? { all: true } : {}),
      }),
    [getAccessToken, direction, value, displayCurrency, all],
  );
  const { quote, error, quoting, secondsLeft, reload, clear } = useLiveQuote(value > 0 ? request : null, phase.kind === 'edit');

  const flip = () => {
    setDirection((d) => (d === 'to_trading' ? 'to_spendable' : 'to_trading'));
    setAll(false);
    setAmount('');
    clear();
  };
  const edit = (raw: string) => {
    setAll(false);
    setAmount(raw);
  };

  const move = async () => {
    if (!quote) return;
    setPhase({ kind: 'preparing' });
    try {
      const final = await runIntent(
        () => executeMove(getAccessToken, quote.quoteId),
        () => setPhase({ kind: 'settling' }),
      );
      void balance.refresh();
      if (!final) setPhase({ kind: 'edit' });
      else if (final.state === 'filled') setPhase({ kind: 'done', quote });
      else setPhase({ kind: 'failed', message: final.error ?? "The move didn't go through. Nothing left your balance." });
    } catch (e) {
      void balance.refresh();
      setPhase({ kind: 'failed', message: e instanceof StillSettling ? 'Still moving. It shows in your balance in a minute.' : friendlyTxError(e) });
    }
  };

  if (phase.kind === 'done') {
    const q = phase.quote;
    return (
      <ResultView
        title={`${stealthMode ? hiddenMoney(q.receive.currency) : formatMoney(q.receive)} moved`}
        subtitle={`It's in your ${POCKETS[to].name.toLowerCase()} balance now.`}>
        {to === 'trading' ? (
          <PillButton label="Start trading" icon="trending-up" onPress={() => router.replace('/trade')} />
        ) : (
          <PillButton label="Send money" icon="arrow-up" onPress={() => { goBack(); withdraw(); }} />
        )}
        <PillButton label="Done" tone="secondary" onPress={goBack} />
      </ResultView>
    );
  }

  const busy = phase.kind === 'preparing' || phase.kind === 'settling';
  const empty = available !== null && available <= 0;

  return (
    <Screen>
      <BackHeader title="Move money" />

      <View style={styles.pockets}>
        <PocketTile label="From" pocket={from} amount={show(from === 'spendable' ? spendable : trading)} />
        <Pressable
          onPress={flip}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Switch: move from ${POCKETS[to].name} to ${POCKETS[from].name}`}
          style={({ pressed }) => [styles.swap, pressed && styles.swapPressed]}>
          <Icon name="swap-horizontal" size={20} color="textOnAccent" />
        </Pressable>
        <PocketTile label="To" pocket={to} amount={show(to === 'spendable' ? spendable : trading)} />
      </View>

      {empty ? (
        <Card style={styles.empty}>
          <Text variant="bodyStrong">
            {from === 'spendable' ? 'Your spendable balance is empty' : 'Nothing in your trading balance yet'}
          </Text>
          <Text color="textSecondary">
            {from === 'spendable'
              ? 'Add money first. It lands in Spendable, then you can move it here to trade.'
              : 'Money from your sales, closed positions and predictions lands here.'}
          </Text>
          {from === 'spendable' ? <PillButton label="Add money" icon="add" size="sm" onPress={addMoney} style={styles.start} /> : null}
        </Card>
      ) : (
        <>
          <AmountInput
            label={`Move to ${POCKETS[to].name}`}
            value={amount}
            onChange={edit}
            currency={displayCurrency}
            onMax={
              available && available > 0
                ? () => {
                    setAmount(available.toFixed(2));
                    setAll(true);
                  }
                : undefined
            }
            maxActive={all}
          />

          {quote ? (
            <Card variant="outlined" style={styles.quote}>
              <Row label={`Arrives in ${POCKETS[to].name}`} value={showMoney(quote.receive)} strong />
              <Row label="Fee" value={showMoney(quote.fee)} />
              <Row label={`Total from ${POCKETS[from].name}`} value={showMoney(quote.send)} />
              <QuoteTimer
                text={quoting ? 'Updating…' : `${quote.eta} · price held for ${secondsLeft}s`}
                onReload={phase.kind === 'edit' ? reload : undefined}
                busy={quoting}
              />
            </Card>
          ) : quoting ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.accentPink} />
              <Text color="textSecondary">Working out the fee…</Text>
            </View>
          ) : error ? (
            <MoneyError message={error} />
          ) : null}

          {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
          {phase.kind === 'settling' ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.accentPink} />
              <Text color="textSecondary">Moving your money… a few seconds</Text>
            </View>
          ) : null}

          <PillButton
            label={quote ? `Move ${showMoney(quote.send)}` : 'Move'}
            icon="swap-horizontal"
            disabled={!quote || quoting || busy}
            loading={busy}
            onPress={move}
          />
          <Text variant="caption" color="textSecondary" style={styles.note}>
            {POCKETS.spendable.name}: {POCKETS.spendable.uses.toLowerCase()}. {POCKETS.trading.name}: {POCKETS.trading.uses.toLowerCase()}.
          </Text>
        </>
      )}
    </Screen>
  );
}

function PocketTile({ label, pocket, amount }: { label: string; pocket: 'spendable' | 'trading'; amount: string }) {
  const p = POCKETS[pocket];
  return (
    <View style={[styles.tile, pocket === 'trading' && styles.tileTrading]}>
      <Text variant="caption" color={pocket === 'trading' ? 'textOnAccent' : 'textSecondary'} style={styles.soft}>
        {label}
      </Text>
      <View style={[styles.tileIcon, pocket === 'trading' && styles.tileIconTrading]}>
        <Icon name={p.icon} size={18} color={pocket === 'trading' ? 'accentPinkDeep' : 'accentPinkTint'} />
      </View>
      <Text variant="bodyStrong" color={pocket === 'trading' ? 'textOnAccent' : 'textPrimary'}>
        {p.name}
      </Text>
      <Text variant="label" color={pocket === 'trading' ? 'textOnAccent' : 'textSecondary'} numberOfLines={1} adjustsFontSizeToFit>
        {amount}
      </Text>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text color="textSecondary">{label}</Text>
      <Text variant={strong ? 'heading' : 'bodyStrong'}>{value}</Text>
    </View>
  );
}

const SWAP = 44;

const styles = themedStyles(() => ({
  pockets: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tile: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.bgSurface,
  },
  tileTrading: {
    backgroundColor: colors.accentPink,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
    backgroundColor: colors.accentPinkMuted,
  },
  tileIconTrading: {
    backgroundColor: colors.surfaceLight,
  },
  soft: {
    opacity: 0.85,
  },
  // The round button between the two tiles, overlapping both.
  swap: {
    width: SWAP,
    height: SWAP,
    borderRadius: SWAP / 2,
    marginHorizontal: -SWAP / 2 + spacing.xs,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.bgBase,
    backgroundColor: colors.accentPinkDeep,
  },
  swapPressed: {
    transform: [{ scale: 0.94 }],
  },
  empty: {
    gap: spacing.sm,
  },
  start: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  quote: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
  },
  busy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  note: {
    textAlign: 'center',
  },
}));
