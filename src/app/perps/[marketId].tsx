import Slider from '@react-native-community/slider';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { PerpQuote } from '@/api/contract';
import { StillSettling, useRunIntent } from '@/api/intents';
import { executePerpQuote, perpsError, requestPerpQuote, usePerpsAccess } from '@/api/perps';
import { useLiveQuote } from '@/api/use-live-quote';
import { useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { EnablePerps } from '@/components/perps/enable-perps';
import { LiquidationPrice } from '@/components/perps/liquidation-price';
import { ResultView } from '@/components/result-view';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatExactMoney, formatMoney, formatPrice, formatTokenAmount } from '@/format/money';
import { useSettings } from '@/settings/context';
import { friendlyTxError } from '@/signing/errors';
import { colors, radii, spacing } from '@/theme';

type Side = 'long' | 'short';
type Phase =
  | { kind: 'edit' }
  | { kind: 'opening' }
  | { kind: 'settling'; funding: boolean }
  | { kind: 'done'; quote: PerpQuote }
  | { kind: 'failed'; message: string };

export default function PerpTicketScreen() {
  const params = useLocalSearchParams<{
    marketId: string;
    symbol: string;
    name: string;
    markPrice: string;
    maxLeverage: string;
    change: string;
    funding: string;
    iconUrl: string;
  }>();
  const { getAccessToken } = useAtlasAuth();
  const { authorized } = usePerpsAccess();
  const { displayCurrency } = useSettings();
  const runIntent = useRunIntent();

  const maxLeverage = Math.max(1, Number(params.maxLeverage) || 1);
  const [side, setSide] = useState<Side>('long');
  const [margin, setMargin] = useState('');
  const [leverage, setLeverage] = useState(Math.min(5, maxLeverage));
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });

  const value = Number(margin) || 0;
  const request = useCallback(
    () =>
      requestPerpQuote(getAccessToken, {
        marketId: params.marketId,
        side,
        leverage,
        margin: { amount: value.toFixed(2), currency: displayCurrency },
      }).catch((e) => {
        throw new Error(perpsError(e, "Opening positions isn't available yet."));
      }),
    [getAccessToken, params.marketId, side, leverage, value, displayCurrency],
  );
  const { quote, quoting, error, secondsLeft, clear } = useLiveQuote(value > 0 ? request : null, phase.kind === 'edit');

  const open = async () => {
    if (!quote) return;
    setPhase({ kind: 'opening' });
    try {
      const final = await runIntent(
        () => executePerpQuote(getAccessToken, quote.quoteId),
        () => setPhase({ kind: 'settling', funding: !!quote.funding }),
        (status) => setPhase({ kind: 'settling', funding: status.stage === 'fund' }),
      );
      if (!final) setPhase({ kind: 'edit' });
      else if (final.state === 'filled') setPhase({ kind: 'done', quote });
      else setPhase({ kind: 'failed', message: final.error ?? 'The position was not opened.' });
    } catch (e) {
      // The order may still land: never invite a second one before the positions say otherwise.
      setPhase({
        kind: 'failed',
        message:
          e instanceof StillSettling
            ? "Paradex hasn't confirmed this order yet. Check your positions before opening another."
            : friendlyTxError(e),
      });
    }
  };

  if (phase.kind === 'done') {
    const q = phase.quote;
    return (
      <ResultView
        title={`You're ${q.side} ${params.symbol} ${q.leverage}×`}
        subtitle={
          q.liquidationPrice
            ? `${formatMoney(q.margin)} margin. Liquidation price ${formatExactMoney(q.liquidationPrice)}.`
            : `${formatMoney(q.margin)} margin. Your liquidation price is on the position now.`
        }>
        <PillButton label="See position" onPress={() => router.navigate('/perps')} />
        <PillButton
          label="Open another"
          tone="secondary"
          onPress={() => {
            setMargin('');
            clear();
            setPhase({ kind: 'edit' });
          }}
        />
      </ResultView>
    );
  }

  const long = side === 'long';
  const leverageChips = [2, 5, 10, maxLeverage].filter((l, i, all) => l <= maxLeverage && all.indexOf(l) === i);

  return (
    <Screen>
      <BackHeader />
      <View style={styles.header}>
        <AssetAvatar symbol={params.symbol} iconUrl={params.iconUrl || null} size={52} />
        <View style={styles.headerText}>
          <Text variant="heading">{/perpetual/i.test(params.name) ? params.name : `${params.name} perpetual`}</Text>
          <Text color="textSecondary">
            Mark {formatPrice({ amount: params.markPrice, currency: displayCurrency })}
            {params.funding ? ` · funding ${params.funding}%/8h` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.segment}>
        {(['long', 'short'] as Side[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSide(s)}
            accessibilityRole="tab"
            accessibilityState={{ selected: side === s }}
            style={[
              styles.segmentItem,
              side === s && { backgroundColor: s === 'long' ? colors.successDim : colors.dangerDim },
            ]}>
            <Text variant="bodyStrong" color={side === s ? (s === 'long' ? 'success' : 'danger') : 'textSecondary'}>
              {s === 'long' ? 'Long ↑' : 'Short ↓'}
            </Text>
          </Pressable>
        ))}
      </View>

      <AmountInput label="Your margin" value={margin} onChange={setMargin} currency={displayCurrency} />

      <Card style={styles.leverage}>
        <View style={styles.leverageHeader}>
          <Text variant="label" color="textSecondary">
            Leverage
          </Text>
          <Text variant="title">{leverage}×</Text>
        </View>
        <Slider
          minimumValue={1}
          maximumValue={maxLeverage}
          step={1}
          value={leverage}
          onValueChange={(v) => setLeverage(Math.round(v))}
          minimumTrackTintColor={colors.accentPink}
          maximumTrackTintColor={colors.bgSurfaceAlt}
          thumbTintColor={colors.accentPink}
          accessibilityLabel="Leverage"
        />
        <View style={styles.chips}>
          {leverageChips.map((l) => (
            <Pressable
              key={l}
              onPress={() => setLeverage(l)}
              style={[styles.chip, leverage === l && { backgroundColor: colors.accentPink }]}>
              <Text variant="label" color={leverage === l ? 'textOnAccent' : 'textPrimary'}>
                {l === maxLeverage ? `Max ${l}×` : `${l}×`}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {quote ? (
        <>
          <LiquidationPrice price={quote.liquidationPrice} side={quote.side} symbol={params.symbol} />
          <Card variant="outlined" style={styles.quote}>
            <Row label="Position size" value={formatTokenAmount(quote.size, params.symbol)} />
            <Row label="Position value" value={formatMoney(quote.notional)} />
            <Row label="Entry price" value={formatPrice(quote.entryPrice)} />
            <Row label="Fee" value={formatMoney(quote.fee)} />
            {quote.funding ? (
              <>
                <Row label="From your balance to Paradex" value={formatMoney(quote.funding.amount)} />
                <Text variant="caption" color="textSecondary">
                  Your Paradex account is short of this margin, so it moves over first, in the same confirmation. It takes
                  about a minute, then your order goes in.
                </Text>
              </>
            ) : null}
            <Text variant="caption" color="textSecondary">
              {phase.kind === 'settling'
              ? phase.funding
                ? 'Moving your margin to Paradex…'
                : 'Confirming with Paradex…'
              : phase.kind === 'opening'
                ? 'Getting your order ready…'
                : quoting
                  ? 'Updating…'
                  : `Held for ${secondsLeft}s`}
            </Text>
          </Card>
        </>
      ) : quoting ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accentPink} />
          <Text color="textSecondary">Working out your liquidation price…</Text>
        </View>
      ) : error ? (
        <Text color="danger">{error}</Text>
      ) : null}

      {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
      {/* Setup is its own one-time step; it never rides along with a trade confirmation. */}
      {authorized ? null : <EnablePerps />}
      <PillButton
        label={authorized ? `Open ${long ? 'long' : 'short'} ${leverage}×` : 'Enable perps first'}
        disabled={!authorized || !quote || quoting}
        loading={phase.kind === 'opening' || phase.kind === 'settling'}
        onPress={open}
      />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text color="textSecondary">{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: {
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
  leverage: {
    gap: spacing.sm,
  },
  leverageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSurfaceAlt,
  },
  quote: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  busy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
