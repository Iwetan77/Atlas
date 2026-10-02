import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { PerpCloseQuote } from '@/api/contract';
import { StillSettling, useRunIntent } from '@/api/intents';
import { executeCloseQuote, perpsError, requestCloseQuote } from '@/api/perps';
import { useLiveQuote } from '@/api/use-live-quote';
import { useAtlasAuth } from '@/auth/context';
import { SideBadge } from '@/components/perps/side-badge';
import { ResultView } from '@/components/result-view';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney, formatPrice } from '@/format/money';
import { friendlyTxError } from '@/signing/errors';
import { colors, radii, spacing } from '@/theme';

type Phase =
  | { kind: 'review' }
  | { kind: 'closing' }
  // `cashing`: the position is closed and its money is on its way back to the balance.
  | { kind: 'settling'; cashing: boolean }
  | { kind: 'done'; quote: PerpCloseQuote }
  | { kind: 'failed'; message: string };

export default function ClosePositionScreen() {
  const params = useLocalSearchParams<{ positionId: string; symbol: string; side: 'long' | 'short'; leverage: string }>();
  const { getAccessToken } = useAtlasAuth();
  const runIntent = useRunIntent();
  const [phase, setPhase] = useState<Phase>({ kind: 'review' });
  // How much of the position to close.
  const [percent, setPercent] = useState(100);

  const request = useCallback(
    () =>
      requestCloseQuote(getAccessToken, params.positionId, percent).catch((e) => {
        throw new Error(perpsError(e, "Closing positions isn't available yet."));
      }),
    [getAccessToken, params.positionId, percent],
  );
  const { quote, quoting, error, secondsLeft } = useLiveQuote(request, phase.kind === 'review');

  const close = async () => {
    if (!quote) return;
    setPhase({ kind: 'closing' });
    let cashing = false;
    try {
      const final = await runIntent(
        () => executeCloseQuote(getAccessToken, quote.quoteId),
        () => setPhase({ kind: 'settling', cashing: false }),
        (status) => {
          cashing = status.stage === 'settle';
          setPhase({ kind: 'settling', cashing });
        },
      );
      if (!final) setPhase({ kind: 'review' });
      else if (final.state === 'filled') setPhase({ kind: 'done', quote });
      else setPhase({ kind: 'failed', message: final.error ?? 'The position was not closed.' });
    } catch (e) {
      // Closed already; the money is still on its way to the balance.
      if (e instanceof StillSettling && cashing) {
        setPhase({ kind: 'done', quote });
        return;
      }
      setPhase({
        kind: 'failed',
        message:
          e instanceof StillSettling
            ? "Hyperliquid hasn't confirmed the close yet. Check your positions before trying again."
            : friendlyTxError(e),
      });
    }
  };

  if (phase.kind === 'done') {
    const pnl = Number(phase.quote.realizedPnl.amount);
    return (
      <ResultView
        title={`${formatMoney(phase.quote.receive)} back in your balance`}
        subtitle={`${percent < 100 ? `${percent}% of ` : ''}${params.symbol} closed with ${pnl >= 0 ? 'a profit' : 'a loss'} of ${formatMoney({
          ...phase.quote.realizedPnl,
          amount: String(Math.abs(pnl)),
        })}.`}>
        <PillButton label="Done" onPress={() => router.navigate('/perps')} />
      </ResultView>
    );
  }

  const pnl = quote ? Number(quote.realizedPnl.amount) : 0;
  return (
    <Screen>
      <BackHeader title="Close position" />
      <View style={styles.header}>
        <Text variant="heading">{params.symbol}</Text>
        <SideBadge side={params.side} leverage={Number(params.leverage)} />
      </View>

      <View style={styles.chips}>
        {[25, 50, 75, 100].map((p) => (
          <Pressable
            key={p}
            onPress={() => setPercent(p)}
            disabled={phase.kind !== 'review' && phase.kind !== 'failed'}
            accessibilityRole="button"
            accessibilityState={{ selected: percent === p }}
            style={[styles.chip, percent === p && styles.chipOn]}>
            <Text variant="label" color={percent === p ? 'textOnAccent' : 'textPrimary'}>
              {p === 100 ? 'All' : `${p}%`}
            </Text>
          </Pressable>
        ))}
      </View>

      {quote ? (
        <Card variant="outlined" style={styles.quote}>
          <Row label="You get back" value={formatMoney(quote.receive)} strong />
          <View style={styles.row}>
            <Text color="textSecondary">Profit / loss</Text>
            <Text variant="bodyStrong" color={pnl >= 0 ? 'success' : 'danger'}>
              {pnl >= 0 ? '+' : ''}
              {formatMoney(quote.realizedPnl)}
            </Text>
          </View>
          <Row label="Exit price" value={formatPrice(quote.exitPrice)} />
          <Row label="Fee" value={formatMoney(quote.fee)} />
          <Text variant="caption" color="textSecondary">
            {phase.kind === 'settling'
              ? phase.cashing
                ? 'Closed. Moving the money to your balance…'
                : 'Confirming with Hyperliquid…'
              : quoting
                ? 'Updating…'
                : `Held for ${secondsLeft}s`}
          </Text>
        </Card>
      ) : quoting ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accentPink} />
          <Text color="textSecondary">Getting the closing price…</Text>
        </View>
      ) : error ? (
        <Text color="danger">{error}</Text>
      ) : null}

      {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
      <PillButton label={percent < 100 ? `Close ${percent}%` : 'Close position'} disabled={!quote || quoting} loading={phase.kind === 'closing' || phase.kind === 'settling'} onPress={close} />
    </Screen>
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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quote: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  busy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSurface,
  },
  chipOn: {
    backgroundColor: colors.accentPink,
  },
});
