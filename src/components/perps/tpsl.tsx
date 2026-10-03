import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DisplayCurrency, PerpPosition, PerpTrigger } from '@/api/contract';
import { setPositionTpsl } from '@/api/perps';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { formatPrice } from '@/format/money';
import { colors, maxContentWidth, radii, spacing } from '@/theme';
import { useDesktop } from '@/web/use-desktop';

// Gains and losses on the margin, the way people think about a trade: "+50%", "−25%".
const TAKE_PROFITS = [25, 50, 100];
const STOP_LOSSES = [10, 25, 50];

// Where the position has gained (or, negative, lost) `pct` percent of its margin: +50% at 5× is a
// 10% move its way.
export function triggerPrice(entry: number, side: 'long' | 'short', leverage: number, pct: number): number {
  const moved = pct / 100 / Math.max(1, leverage);
  return entry * (side === 'long' ? 1 + moved : 1 - moved);
}

// The chips: Off and the usual picks, plus one already set that isn't among them.
function options(base: number[], current: number | null, fits: (pct: number) => boolean): number[] {
  const all = current !== null && !base.includes(current) ? [...base, current].sort((a, b) => a - b) : base;
  return all.filter(fits);
}

// Take-profit and stop-loss as two rows of chips, each with the price it closes at.
export function TpslPicker({
  side,
  leverage,
  entry,
  currency,
  takeProfit,
  stopLoss,
  onTakeProfit,
  onStopLoss,
}: {
  side: 'long' | 'short';
  leverage: number;
  // The price they're measured from (the market price before opening, the entry after).
  entry: number;
  currency: DisplayCurrency;
  takeProfit: number | null;
  stopLoss: number | null;
  onTakeProfit: (pct: number | null) => void;
  onStopLoss: (pct: number | null) => void;
}) {
  // A short can't make 100% per 1× of leverage: the price would have to reach zero.
  const tps = options(TAKE_PROFITS, takeProfit, (p) => side === 'long' || p < 100 * leverage);
  const sls = options(STOP_LOSSES, stopLoss, (p) => p <= 90);
  const at = (pct: number) =>
    entry > 0 ? formatPrice({ amount: triggerPrice(entry, side, leverage, pct).toString(), currency }) : null;
  return (
    <View style={styles.picker}>
      <ChipRow
        title="Take profit"
        sign="+"
        values={tps}
        value={takeProfit}
        onChange={onTakeProfit}
        hint={takeProfit === null ? 'Off' : `Closes at ${at(takeProfit) ?? '—'}`}
        hintColor={takeProfit === null ? 'textSecondary' : 'success'}
      />
      <ChipRow
        title="Stop loss"
        sign="−"
        values={sls}
        value={stopLoss}
        onChange={onStopLoss}
        hint={stopLoss === null ? 'Off' : `Closes at ${at(-stopLoss) ?? '—'}`}
        hintColor={stopLoss === null ? 'textSecondary' : 'danger'}
      />
    </View>
  );
}

function ChipRow({
  title,
  sign,
  values,
  value,
  onChange,
  hint,
  hintColor,
}: {
  title: string;
  sign: string;
  values: number[];
  value: number | null;
  onChange: (pct: number | null) => void;
  hint: string;
  hintColor: 'textSecondary' | 'success' | 'danger';
}) {
  return (
    <View style={styles.chipRow}>
      <View style={styles.chipHeader}>
        <Text variant="label" color="textSecondary" style={styles.title}>
          {title}
        </Text>
        <Text variant="caption" color={hintColor} numberOfLines={1} style={styles.hint}>
          {hint}
        </Text>
      </View>
      <View style={styles.chips}>
        {[null, ...values].map((v) => {
          const on = v === value;
          return (
            <Pressable
              key={v ?? 'off'}
              onPress={() => onChange(v)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={v === null ? `${title} off` : `${title} ${sign}${v}%`}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}>
              <Text variant="label" color={on ? 'textOnAccent' : 'textPrimary'}>
                {v === null ? 'Off' : `${sign}${v}%`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const pctOf = (t: PerpTrigger | null | undefined) => (t ? Math.abs(Math.round(Number(t.pct))) : null);

// On a position: what's set, in one line, and the way to change it.
export function TpslLine({ position: p, onChanged }: { position: PerpPosition; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const tp = p.takeProfit ?? null;
  const sl = p.stopLoss ?? null;
  return (
    <>
      <Pressable
        onPress={() => setEditing(true)}
        accessibilityRole="button"
        accessibilityLabel="Take profit and stop loss"
        style={({ pressed }) => [styles.line, pressed && styles.pressed]}>
        <View style={styles.lineIcon}>
          <Icon name="flag-outline" size={16} color="accentPinkTint" />
        </View>
        <View style={styles.lineText}>
          {tp || sl ? (
            <>
              <Text variant="caption" color={tp ? 'success' : 'textSecondary'} numberOfLines={1}>
                {tp ? `Take profit +${pctOf(tp)}% · ${formatPrice(tp.price)}` : 'No take profit'}
              </Text>
              <Text variant="caption" color={sl ? 'danger' : 'textSecondary'} numberOfLines={1}>
                {sl ? `Stop loss −${pctOf(sl)}% · ${formatPrice(sl.price)}` : 'No stop loss'}
              </Text>
            </>
          ) : (
            <>
              <Text variant="bodyStrong">Take profit & stop loss</Text>
              <Text variant="caption" color="textSecondary">
                Close it for you at a gain or before a big loss
              </Text>
            </>
          )}
        </View>
        <Text variant="label" color="accentPinkTint">
          {tp || sl ? 'Edit' : 'Set'}
        </Text>
      </Pressable>
      {editing ? (
        <TpslSheet
          position={p}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}

function TpslSheet({ position: p, onClose, onSaved }: { position: PerpPosition; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { getAccessToken } = useAtlasAuth();
  const [takeProfit, setTakeProfit] = useState<number | null>(pctOf(p.takeProfit));
  const [stopLoss, setStopLoss] = useState<number | null>(pctOf(p.stopLoss));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const unchanged = takeProfit === pctOf(p.takeProfit) && stopLoss === pctOf(p.stopLoss);

  const save = async () => {
    setSaving(true);
    setProblem(null);
    try {
      await setPositionTpsl(getAccessToken, p.positionId, takeProfit, stopLoss);
      onSaved();
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, desktop && styles.backdropDesktop]} onPress={onClose} accessibilityLabel="Close">
        <Pressable
          style={[styles.sheet, desktop && styles.sheetDesktop, { paddingBottom: insets.bottom + spacing.xl }]}
          onPress={() => {}}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <Text variant="title">Take profit & stop loss</Text>
            <Text color="textSecondary">
              {p.symbol} {p.side} {p.leverage}× · entry {formatPrice(p.entryPrice)}. When the price gets there, the whole
              position closes for you.
            </Text>
          </View>
          <TpslPicker
            side={p.side}
            leverage={p.leverage}
            entry={Number(p.entryPrice.amount)}
            currency={p.entryPrice.currency}
            takeProfit={takeProfit}
            stopLoss={stopLoss}
            onTakeProfit={setTakeProfit}
            onStopLoss={setStopLoss}
          />
          {problem ? <Text color="danger">{problem}</Text> : null}
          <PillButton label="Save" loading={saving} disabled={unchanged} onPress={save} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  picker: {
    gap: spacing.lg,
  },
  chipRow: {
    gap: spacing.sm,
  },
  chipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flexShrink: 0,
  },
  hint: {
    flexShrink: 1,
    textAlign: 'right',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSurfaceAlt,
  },
  chipOn: {
    backgroundColor: colors.accentPink,
  },
  pressed: {
    opacity: 0.8,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bgSurface,
  },
  lineIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPinkDim,
  },
  lineText: {
    flex: 1,
    gap: spacing.xxs,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  backdropDesktop: {
    justifyContent: 'center',
    padding: 32,
  },
  sheet: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: spacing.lg,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    backgroundColor: colors.bgSurface,
  },
  sheetDesktop: {
    borderRadius: 28,
    paddingTop: 24,
  },
  sheetHeader: {
    gap: spacing.xs,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
});
