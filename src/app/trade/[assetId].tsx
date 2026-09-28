import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { IntentStatus, Quote, TradeSide } from '@/api/contract';
import { executeQuote, requestQuote, submitIntent, waitForIntent } from '@/api/markets';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { currencySymbol, formatMoney, formatPrice, formatTokenAmount, groupDigits } from '@/format/money';
import { useSettings } from '@/settings/context';
import { ActionCancelled, useConfirmAndExecute } from '@/signing/confirm';
import { friendlyTxError } from '@/signing/errors';
import { colors, radii, spacing, type as typeScale } from '@/theme';

// Quick picks per display currency, roughly the same spend everywhere.
const QUICK: Record<string, number[]> = {
  NGN: [5_000, 10_000, 50_000],
  USD: [5, 10, 50],
  KES: [500, 1_000, 5_000],
  GHS: [50, 100, 500],
  ZAR: [100, 200, 1_000],
};

type Phase =
  | { kind: 'edit' }
  | { kind: 'preparing' }
  | { kind: 'settling' }
  | { kind: 'done'; status: IntentStatus; quote: Quote }
  | { kind: 'failed'; message: string };

export default function AssetTradeScreen() {
  const params = useLocalSearchParams<{
    assetId: string;
    symbol: string;
    name: string;
    price: string;
    iconUrl: string;
    change: string;
  }>();
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const confirmAndExecute = useConfirmAndExecute();

  const [side, setSide] = useState<TradeSide>('buy');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });
  const [now, setNow] = useState(Date.now());
  const quoteSeq = useRef(0);

  const value = Number(amount) || 0;
  const change = params.change ? Number(params.change) : null;

  const fetchQuote = useCallback(async () => {
    if (value <= 0) {
      setQuote(null);
      return;
    }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    setQuoteError(null);
    try {
      const q = await requestQuote(getAccessToken, {
        assetId: params.assetId,
        side,
        amount: { amount: value.toFixed(2), currency: displayCurrency },
      });
      // A slower, older request must not overwrite a newer quote.
      if (seq === quoteSeq.current) setQuote(q);
    } catch (e) {
      if (seq === quoteSeq.current) {
        setQuote(null);
        setQuoteError(errorMessage(e));
      }
    } finally {
      if (seq === quoteSeq.current) setQuoting(false);
    }
  }, [value, side, displayCurrency, params.assetId, getAccessToken]);

  // Re-quote shortly after the amount or side settles.
  useEffect(() => {
    if (phase.kind !== 'edit') return;
    const id = setTimeout(fetchQuote, 600);
    return () => clearTimeout(id);
  }, [fetchQuote, phase.kind]);

  // Countdown, and a fresh quote once this one expires.
  useEffect(() => {
    if (!quote || phase.kind !== 'edit') return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() > quote.expiresAtUnixMs) fetchQuote();
    }, 1000);
    return () => clearInterval(id);
  }, [quote, phase.kind, fetchQuote]);

  const trade = async () => {
    if (!quote) return;
    setPhase({ kind: 'preparing' });
    try {
      const plan = await executeQuote(getAccessToken, quote.quoteId);
      // The one user-facing confirmation for this whole action.
      const report = await confirmAndExecute(plan);
      setPhase({ kind: 'settling' });
      const first = await submitIntent(getAccessToken, plan.intentId, { sent: report.sent, signed: report.signed });
      const final = await waitForIntent(getAccessToken, first);
      setPhase(
        final.state === 'filled'
          ? { kind: 'done', status: final, quote }
          : { kind: 'failed', message: final.error ?? 'The trade did not go through.' },
      );
    } catch (e) {
      if (e instanceof ActionCancelled) setPhase({ kind: 'edit' });
      else setPhase({ kind: 'failed', message: friendlyTxError(e) });
    }
  };

  const verb = side === 'buy' ? 'Buy' : 'Sell';

  if (phase.kind === 'done') {
    const got = phase.quote.side === 'buy' ? phase.quote.receive : phase.quote.pay;
    return (
      <Screen style={styles.center}>
        <View style={styles.resultIcon}>
          <Icon name="checkmark" size={36} color="textOnAccent" />
        </View>
        <Text variant="title" style={styles.centerText}>
          {phase.quote.side === 'buy' ? 'You bought' : 'You sold'} {formatTokenAmount(got.amount, got.symbol)}
        </Text>
        <Text color="textSecondary" style={styles.centerText}>
          {phase.quote.side === 'buy'
            ? `${formatMoney(phase.quote.pay.value)} from your balance`
            : `${formatMoney(phase.quote.receive.value)} added to your balance`}
        </Text>
        <View style={styles.resultActions}>
          <PillButton label="Done" onPress={() => router.navigate('/')} />
          <PillButton
            label="Trade again"
            tone="secondary"
            onPress={() => {
              setAmount('');
              setQuote(null);
              setPhase({ kind: 'edit' });
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackHeader />

      <View style={styles.assetHeader}>
        <AssetAvatar symbol={params.symbol} iconUrl={params.iconUrl || null} size={52} />
        <View style={styles.assetText}>
          <Text variant="heading">{params.name}</Text>
          <Text color="textSecondary">
            {formatPrice({ amount: params.price, currency: displayCurrency })}
            {change === null ? '' : '  '}
            {change === null ? null : (
              <Text color={change >= 0 ? 'success' : 'danger'}>
                {change >= 0 ? '+' : ''}
                {change.toFixed(2)}%
              </Text>
            )}
          </Text>
        </View>
      </View>

      <View style={styles.segment}>
        {(['buy', 'sell'] as TradeSide[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSide(s)}
            accessibilityRole="tab"
            accessibilityState={{ selected: side === s }}
            style={[styles.segmentItem, side === s && styles.segmentActive]}>
            <Text variant="bodyStrong" color={side === s ? 'textOnAccent' : 'textSecondary'}>
              {s === 'buy' ? 'Buy' : 'Sell'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Card style={styles.amountCard}>
        <Text variant="label" color="textSecondary">
          {side === 'buy' ? 'You spend' : 'You sell (value)'}
        </Text>
        <View style={styles.amountRow}>
          <Text variant="display" color="textSecondary">
            {currencySymbol(displayCurrency)}
          </Text>
          <TextInput
            value={groupDigits(amount)}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
            placeholder="0"
            placeholderTextColor={colors.textDisabled}
            keyboardType="decimal-pad"
            style={styles.amountInput}
            selectionColor={colors.accentPink}
            accessibilityLabel={`Amount in ${displayCurrency}`}
          />
        </View>
        <View style={styles.quick}>
          {(QUICK[displayCurrency] ?? QUICK.USD).map((q) => (
            <Pressable key={q} onPress={() => setAmount(String(q))} style={styles.quickChip}>
              <Text variant="label">{formatMoney({ amount: String(q), currency: displayCurrency }).replace(/\.00$/, '')}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {quote ? (
        <Card variant="outlined" style={styles.quote}>
          <QuoteRow label="You pay" value={side === 'buy' ? formatMoney(quote.pay.value) : formatTokenAmount(quote.pay.amount, quote.pay.symbol)} />
          <QuoteRow
            label="You get"
            value={side === 'buy' ? formatTokenAmount(quote.receive.amount, quote.receive.symbol) : formatMoney(quote.receive.value)}
            strong
          />
          <QuoteRow label="Price" value={`${formatPrice(quote.price)} / ${params.symbol}`} />
          <QuoteRow label="Fee" value={formatMoney(quote.fee)} />
          <Text variant="caption" color="textSecondary">
            {quoting ? 'Updating price…' : `Price held for ${Math.max(0, Math.ceil((quote.expiresAtUnixMs - now) / 1000))}s`}
          </Text>
        </Card>
      ) : quoting ? (
        <View style={styles.quoting}>
          <ActivityIndicator color={colors.accentPink} />
          <Text color="textSecondary">Getting the best price…</Text>
        </View>
      ) : quoteError ? (
        <Text color="danger">Couldn&apos;t get a price: {quoteError}</Text>
      ) : null}

      {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
      {phase.kind === 'settling' ? (
        <View style={styles.quoting}>
          <ActivityIndicator color={colors.accentPink} />
          <Text color="textSecondary">
            {side === 'buy' ? 'Buying' : 'Selling'} {params.symbol}… this usually takes a few seconds
          </Text>
        </View>
      ) : null}

      <PillButton
        label={`${verb} ${params.symbol}`}
        disabled={!quote || quoting || phase.kind === 'settling'}
        loading={phase.kind === 'preparing' || phase.kind === 'settling'}
        onPress={trade}
      />
    </Screen>
  );
}

function QuoteRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.quoteRow}>
      <Text color="textSecondary">{label}</Text>
      <Text variant={strong ? 'heading' : 'bodyStrong'}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  centerText: {
    textAlign: 'center',
  },
  resultIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultActions: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  assetText: {
    flex: 1,
    gap: spacing.xxs,
  },
  segment: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSurface,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  segmentActive: {
    backgroundColor: colors.accentPink,
  },
  amountCard: {
    gap: spacing.md,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  amountInput: {
    flex: 1,
    ...typeScale.display,
    color: colors.textPrimary,
    padding: 0,
  },
  quick: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickChip: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSurfaceAlt,
  },
  quote: {
    gap: spacing.md,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
  },
  quoting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
