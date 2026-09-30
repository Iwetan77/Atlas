import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { EarnAction, EarnOption, EarnPosition, EarnQuote } from '@/api/contract';
import { executeEarnQuote, requestEarnQuote, useEarn } from '@/api/earn';
import { StillSettling, useRunIntent } from '@/api/intents';
import { useLiveQuote } from '@/api/use-live-quote';
import { useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { ResultView } from '@/components/result-view';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/format/money';
import { useSettings } from '@/settings/context';
import { friendlyTxError } from '@/signing/errors';
import { colors, radii, spacing } from '@/theme';

type Phase =
  | { kind: 'edit' }
  | { kind: 'working' }
  | { kind: 'done'; quote: EarnQuote }
  | { kind: 'failed'; message: string };

const CHAIN_NAMES: Record<string, string> = { base: 'Base', solana: 'Solana' };

// Savings: put cash from the balance into a lending market and take it out, at its live (variable)
// rate. Each option uses the cash on its own chain; the best rate comes first.
export default function EarnScreen() {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const { options, positions, reload } = useEarn();
  const runIntent = useRunIntent();
  const [picked, setPicked] = useState<string | null>(null);
  const option = options?.find((o) => o.optionId === picked) ?? options?.[0];
  const position = positions?.find((p) => p.optionId === option?.optionId);
  const chainName = option ? (CHAIN_NAMES[option.chain] ?? option.chain) : '';

  const [action, setAction] = useState<EarnAction>('deposit');
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });
  const value = Number(amount) || 0;

  const request = useCallback(
    () =>
      requestEarnQuote(getAccessToken, {
        optionId: option?.optionId ?? '',
        action,
        amount: { amount: value.toFixed(2), currency: displayCurrency },
      }),
    [getAccessToken, option?.optionId, action, value, displayCurrency],
  );
  const { quote, quoting, error, clear } = useLiveQuote(value > 0 && option ? request : null, phase.kind === 'edit');

  const go = async () => {
    if (!quote) return;
    setPhase({ kind: 'working' });
    try {
      const final = await runIntent(() => executeEarnQuote(getAccessToken, quote.quoteId));
      if (!final) setPhase({ kind: 'edit' });
      else if (final.state === 'filled') {
        setPhase({ kind: 'done', quote });
        reload();
      } else setPhase({ kind: 'failed', message: final.error ?? "That didn't go through." });
    } catch (e) {
      setPhase({
        kind: 'failed',
        message: e instanceof StillSettling ? `Still confirming on ${chainName}. Check your balance in a minute.` : friendlyTxError(e),
      });
    }
  };

  if (phase.kind === 'done') {
    const q = phase.quote;
    return (
      <ResultView
        title={q.action === 'deposit' ? `${formatMoney(q.amount)} is earning` : `${formatMoney(q.amount)} is back in your balance`}
        subtitle={q.action === 'deposit' ? `At ${q.apyPct}% a year right now. The rate moves with demand.` : 'Interest included.'}>
        <PillButton label="Done" onPress={() => router.navigate('/')} />
        <PillButton
          label={q.action === 'deposit' ? 'Put in more' : 'Take out more'}
          tone="secondary"
          onPress={() => {
            setAmount('');
            clear();
            setPhase({ kind: 'edit' });
          }}
        />
      </ResultView>
    );
  }

  return (
    <Screen>
      <BackHeader title="Savings" />
      {options && options.length > 1 ? (
        <View style={styles.options}>
          {options.map((o) => (
            <OptionRow
              key={o.optionId}
              option={o}
              position={positions?.find((p) => p.optionId === o.optionId)}
              selected={o.optionId === option?.optionId}
              onPress={() => {
                setPicked(o.optionId);
                // Nothing to take out of an option you haven't used.
                if (!positions?.some((p) => p.optionId === o.optionId)) setAction('deposit');
              }}
            />
          ))}
        </View>
      ) : null}

      {option ? (
        <Card style={styles.rateCard}>
          <Text variant="label" color="textSecondary">
            {option.name} · {option.venue} · cash on {chainName}
          </Text>
          <Text variant="display" color="success">
            {option.apyPct}%
          </Text>
          <Text color="textSecondary">a year, right now. {option.about}</Text>
          {position ? (
            <Text variant="bodyStrong">You have {formatMoney(position.value)} earning.</Text>
          ) : null}
        </Card>
      ) : (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accentPink} />
          <Text color="textSecondary">Getting the rate…</Text>
        </View>
      )}

      <View style={styles.segment}>
        {(['deposit', 'withdraw'] as EarnAction[]).map((a) => (
          <Pressable
            key={a}
            onPress={() => setAction(a)}
            disabled={a === 'withdraw' && !position}
            accessibilityRole="tab"
            accessibilityState={{ selected: action === a, disabled: a === 'withdraw' && !position }}
            style={[styles.segmentItem, action === a && styles.segmentActive]}>
            <Text variant="bodyStrong" color={action === a ? 'textOnAccent' : 'textSecondary'}>
              {a === 'deposit' ? 'Put in' : 'Take out'}
            </Text>
          </Pressable>
        ))}
      </View>

      <AmountInput
        label={action === 'deposit' ? 'From your balance' : 'From savings'}
        value={amount}
        onChange={setAmount}
        currency={displayCurrency}
      />

      {quote ? (
        <Card variant="outlined" style={styles.quote}>
          <Row label={action === 'deposit' ? 'Goes into savings' : 'Comes back to your balance'} value={quote.all ? 'Everything, with interest' : formatMoney(quote.amount)} />
          <Row label="Rate now" value={`${quote.apyPct}% a year`} />
          <Text variant="caption" color="textSecondary">
            {option?.chain === 'base' ? 'Your cash moves on Base as USDC. Gas is on Atlas.' : `Your cash moves on ${chainName} as USDC.`}
          </Text>
        </Card>
      ) : quoting ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accentPink} />
          <Text color="textSecondary">Checking…</Text>
        </View>
      ) : error ? (
        <Text color="danger">{error}</Text>
      ) : null}

      {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
      <PillButton
        label={action === 'deposit' ? 'Put in savings' : 'Take out'}
        disabled={!quote || quoting}
        loading={phase.kind === 'working'}
        onPress={go}
      />
    </Screen>
  );
}

function OptionRow({
  option,
  position,
  selected,
  onPress,
}: {
  option: EarnOption;
  position: EarnPosition | undefined;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.option, selected && styles.optionSelected]}>
      <View style={styles.optionText}>
        <Text variant="bodyStrong">{option.venue}</Text>
        <Text variant="caption" color="textSecondary">
          {position ? `${formatMoney(position.value)} earning` : `Uses your cash on ${CHAIN_NAMES[option.chain] ?? option.chain}`}
        </Text>
      </View>
      <Text variant="bodyStrong" color="success">
        {option.apyPct}%
      </Text>
    </Pressable>
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
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionSelected: {
    borderColor: colors.accentPink,
    backgroundColor: colors.bgSurface,
  },
  optionText: {
    flex: 1,
    gap: spacing.xxs,
  },
  rateCard: {
    gap: spacing.xs,
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
  quote: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  busy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
