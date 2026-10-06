import { submitPredictionStep } from '@/signing/prediction';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesktop } from '@/web/use-desktop';

import { authorizePin } from '@/api/pin';
import { PinPad } from '@/security/pin-pad';
import type { ExecutionPlan, IntentKind, SentTx, SignedTx } from '@/api/contract';
import { useBalance } from '@/api/balance';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { spendableAmount } from '@/components/send/spendable-card';
import { formatMoney, hiddenMoney } from '@/format/money';
import { useSettings } from '@/settings/context';
import { Text } from '@/components/ui/text';
import { useAtlasAuth } from '@/auth/context';
import { sendOnce, waitForTx } from '@/signing/chains';
import { friendlyTxError } from '@/signing/errors';
import { useSigner } from '@/signing/use-signer';
import { watchWalletPrompts } from '@/signing/wallet-prompts';
import { colors, maxContentWidth, radii, spacing, themedStyles } from '@/theme';

// What one user action actually cost, so the one-confirmation rule can be checked, not assumed.
export type ActionReport = {
  intentId: string;
  pinAuthorization: string;
  transactions: number;
  confirmations: number;
  walletPrompts: number;
  // Broadcast by the app and landed.
  sent: SentTx[];
  // Signed for the engine to land (submit: 'engine'); the caller hands these to the engine.
  signed: SignedTx[];
};

export class ActionCancelled extends Error {
  constructor() {
    super('Cancelled');
  }
}

type Pending = {
  plan: ExecutionPlan;
  // When the quote runs out by this phone's clock.
  deadline: number;
  resolve: (r: ActionReport) => void;
  reject: (e: Error) => void;
};

type Phase = { kind: 'review' } | { kind: 'enter' } | { kind: 'pin' } | { kind: 'signing'; step: number } | { kind: 'error'; message: string };

const TITLES: Record<IntentKind, string> = {
  buy: 'Buy',
  sell: 'Sell',
  send: 'Send',
  off_ramp: 'Withdraw',
  perp_open: 'Open position',
  perp_close: 'Close position',
  earn_deposit: 'Put in savings',
  earn_withdraw: 'Take out of savings',
  withdraw: 'Withdraw',
};

// The confirmation reads like a payment slip: the total big at the top, who it goes to, then the
// details. Status lines belong on the receipt, not on a confirmation.
const HEADLINES = ['Total from cash', 'You pay', 'You sell', 'Margin moved', 'Margin moved to Hyperliquid'];
const RECIPIENTS = ['Send to', 'To'];
const HIDDEN = ['Bank payout', 'Status'];
type Row = { label: string; value: string };
function slip(summary: Row[]) {
  const headline = HEADLINES.map((l) => summary.find((r) => r.label === l)).find(Boolean) ?? null;
  const to = summary.find((r) => RECIPIENTS.includes(r.label)) ?? null;
  // "Opay · 9033935622 · NAME": the name on its own line, the bank and number under it.
  const parts = to ? to.value.split(' · ') : [];
  const recipient = to ? { name: parts.length > 1 ? parts[parts.length - 1] : to.value, detail: parts.length > 1 ? parts.slice(0, -1).join(' · ') : null } : null;
  const rows = summary.filter((r) => r !== to && !HIDDEN.includes(r.label));
  return { headline, recipient, rows };
}

const ConfirmContext = createContext<((plan: ExecutionPlan) => Promise<ActionReport>) | null>(null);

export function useConfirmAndExecute() {
  const run = useContext(ConfirmContext);
  if (!run) throw new Error('useConfirmAndExecute must be used inside <ConfirmProvider>');
  return run;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const signer = useSigner();
  const { wallets, getAccessToken } = useAtlasAuth();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const [pending, setPending] = useState<Pending | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'review' });
  const confirmations = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  const currentReview = useRef<Pending | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; currentReview.current?.reject(new ActionCancelled()); currentReview.current = null; }; }, []);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinReset, setPinReset] = useState(0);

  const confirmAndExecute = useCallback((plan: ExecutionPlan) => {
    return new Promise<ActionReport>((resolve, reject) => {
      if (currentReview.current) { reject(new Error("Finish the current payment first.")); return; }
      confirmations.current = 0;
      setPhase({ kind: 'review' });
      setPinError(null); setPinReset((n) => n+1); busy.current = false;
      // The plan's lifetime as the engine set it (about two minutes), started now on this phone.
      const lifetime = plan.expiresAtUnixMs - Date.now();
      const deadline = lifetime > 5_000 && lifetime <= 10 * 60_000 ? plan.expiresAtUnixMs : Date.now() + 110_000;
      const next = { plan, deadline, resolve, reject }; currentReview.current = next; setPending(next);
    });
  }, []);

  const close = () => { busy.current = false; currentReview.current = null; setPending(null); };

  const cancel = () => {
    if (busy.current) return;
    pending?.reject(new ActionCancelled());
    close();
  };

  const confirm = async (pin: string) => {
    if (!pending || busy.current || phase.kind !== 'enter') return;
    busy.current = true;
    const mine = pending;
    if (Date.now() >= mine.deadline) {
      busy.current = false; setPhase({ kind: 'review' }); setPinReset((n) => n+1); return;
    }
    setPhase({ kind: 'pin' }); setPinError(null);
    let pinAuthorization: string;
    try {
      const grant = await authorizePin(getAccessToken, pin, { type: 'intent', intentId: mine.plan.intentId });
      if (!mounted.current || currentReview.current !== mine) return;
      if (Date.now() >= mine.deadline) throw new Error('This quote expired. Go back and try again.');
      pinAuthorization = grant.authorization;
    } catch (e) {
      busy.current = false; setPhase({ kind: 'enter' }); setPinError(friendlyTxError(e)); setPinReset((n) => n+1); return;
    }
    const { plan } = pending;
    confirmations.current += 1;
    const stopWatching = watchWalletPrompts();
    const sent: SentTx[] = [];
    const signed: SignedTx[] = [];
    try {
      for (const [index, tx] of plan.transactions.entries()) {
        setPhase({ kind: 'signing', step: index + 1 });
        if ('typedData' in tx) {
          signed.push({ index, transaction: tx.prediction ? await submitPredictionStep(tx, getAccessToken, signer, pinAuthorization) : await signer.sign(tx) });
          continue;
        }
        if (tx.chain === 'privy') {
          signed.push({ index, transaction: await signer.approve(tx.request) });
          continue;
        }
        if (tx.chain === 'solana' && tx.submit === 'engine') {
          signed.push({ index, transaction: await signer.sign(tx) });
          continue;
        }
        const result = await sendOnce(() => signer.send(tx), tx, wallets.base, sent.length > 0);
        await waitForTx(result, tx);
        sent.push(result);
      }
      pending.resolve({
        intentId: plan.intentId,
        pinAuthorization,
        transactions: plan.transactions.length,
        confirmations: confirmations.current,
        walletPrompts: stopWatching(),
        sent,
        signed,
      });
      close();
    } catch (e) {
      stopWatching();
      setPhase({ kind: 'error', message: friendlyTxError(e) });
    }
  };

  const failAfterError = () => {
    if (phase.kind === 'error') pending?.reject(new Error(phase.message));
    close();
  };

  const plan = pending?.plan;
  // Flips when the plan's quote actually runs out, even if the sheet just sits open. Timed from when
  // the plan arrived: a phone clock that's a few minutes off made every quote look expired at once
  // (the engine still refuses a plan that really has expired).
  const [expiredPlan, setExpiredPlan] = useState<ExecutionPlan | null>(null);
  useEffect(() => {
    if (!plan) return;
    const id = setTimeout(() => setExpiredPlan(plan), Math.max(0, (pending?.deadline ?? plan.expiresAtUnixMs) - Date.now()));
    return () => clearTimeout(id);
  }, [plan, pending?.deadline]);
  const expired = !!plan && expiredPlan === plan;

  return (
    <ConfirmContext.Provider value={confirmAndExecute}>
      {children}
      <Modal visible={!!pending} transparent animationType="slide" onRequestClose={cancel}>
        <Pressable style={[styles.backdrop, desktop && { justifyContent: 'center', padding: 32 }]} onPress={phase.kind === 'review' ? cancel : undefined}>
          <Pressable style={[styles.sheet, desktop && { borderRadius: 28, maxHeight: '85%', paddingTop: 24 }, { paddingBottom: insets.bottom + spacing.xl }]}>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <View style={styles.grabber} />
            {plan ? <Slip
              plan={plan}
              phase={phase}
              expired={expired}
              ready={signer.ready}
              waiting={signer.waiting ?? null}
              pinError={pinError}
              pinReset={pinReset}
              onPay={() => { setPinError(null); setPinReset((n) => n+1); setPhase({ kind: 'enter' }); }}
              onBack={() => setPhase({ kind: 'review' })}
              onCancel={cancel}
              onPin={confirm}
              onClose={failAfterError}
            /> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

function Slip({ plan, phase, expired, ready, waiting, pinError, pinReset, onPay, onBack, onCancel, onPin, onClose }: {
  plan: ExecutionPlan; phase: Phase; expired: boolean; ready: boolean; waiting: string | null; pinError: string | null; pinReset: number;
  onPay: () => void; onBack: () => void; onCancel: () => void; onPin: (pin: string) => void; onClose: () => void;
}) {
  const { headline, recipient, rows } = slip(plan.summary);
  const total = headline?.value ?? null;

  if (phase.kind === 'enter') {
    return (
      <View style={styles.pinSheet}>
        <View style={styles.topBar}>
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to the summary">
            <Icon name="close" size={24} color="textPrimary" />
          </Pressable>
          <Text variant="bodyStrong">Enter payment PIN</Text>
          <View style={styles.topSpacer} />
        </View>
        {total ? (
          <Text color="textSecondary" style={styles.center}>
            {recipient ? `${total} to ${recipient.name}` : `${TITLES[plan.kind]} · ${total}`}
          </Text>
        ) : null}
        <PinPad onComplete={onPin} disabled={expired || !ready} resetKey={pinReset} />
        {pinError ? <Text color="danger" style={styles.center} accessibilityRole="alert">{pinError}</Text> : null}
        {expired ? <Text color="danger" style={styles.center}>This quote expired. Go back and try again.</Text> : null}
      </View>
    );
  }

  return (
    <>
      <View style={styles.topBar}>
        <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel" disabled={phase.kind !== 'review'}>
          <Icon name="close" size={24} color={phase.kind === 'review' ? 'textPrimary' : 'textDisabled'} />
        </Pressable>
        <Text variant="bodyStrong">{TITLES[plan.kind]}</Text>
        <View style={styles.topSpacer} />
      </View>

      {headline ? (
        <View style={styles.headline}>
          <Text variant="caption" color="textSecondary">{headline.label}</Text>
          <Text variant="display" style={styles.center} numberOfLines={2} adjustsFontSizeToFit>{headline.value}</Text>
        </View>
      ) : null}

      {recipient ? (
        <View style={styles.recipient}>
          <View style={styles.recipientIcon}>
            <Icon name={recipient.detail ? 'business-outline' : 'person-outline'} size={20} color="accentPinkTint" />
          </View>
          <View style={styles.recipientText}>
            <Text variant="bodyStrong" style={styles.wrap}>{recipient.name}</Text>
            {recipient.detail ? <Text variant="caption" color="textSecondary" style={styles.wrap}>{recipient.detail}</Text> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.details}>
        {rows.map((row) => (
          <View key={row.label} style={[styles.row, row === headline && styles.totalRow]}>
            <Text color="textSecondary" style={styles.rowLabel}>{row.label}</Text>
            <Text variant={row === headline ? 'bodyStrong' : 'body'} style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
        <PayFrom />
      </View>

      {phase.kind === 'review' ? (
        <View style={styles.actions}>
          {expired ? <Text color="danger">This quote expired. Go back and try again.</Text> : null}
          {!expired && !ready ? (
            <View style={styles.waiting}><ActivityIndicator color={colors.accentPink} /><Text color="textSecondary" style={styles.waitingText}>{waiting ?? 'Connecting your wallet…'}</Text></View>
          ) : null}
          <PillButton label={total ? `Pay ${total}` : 'Continue'} onPress={onPay} disabled={expired || !ready} />
        </View>
      ) : null}

      {phase.kind === 'pin' ? <View style={styles.progress}><ActivityIndicator color={colors.accentPink} /><Text color="textSecondary">Checking your PIN…</Text></View> : null}

      {phase.kind === 'signing' ? (
        <View style={styles.progress}>
          <ActivityIndicator color={colors.accentPink} />
          <Text color="textSecondary">
            {plan.transactions.length > 1 ? `Working on it… step ${phase.step} of ${plan.transactions.length}` : 'Working on it…'}
          </Text>
        </View>
      ) : null}

      {phase.kind === 'error' ? (
        <View style={styles.actions}>
          <Text color="danger">{phase.message}</Text>
          <PillButton label="Close" tone="secondary" onPress={onClose} />
        </View>
      ) : null}
    </>
  );
}

// Where the money comes from: the cash that can actually pay (coins, savings and perps margin count
// in the balance but can't). Mounted only while a confirmation is open, so it never keeps the
// balance polling on its own.
function PayFrom() {
  const { data } = useBalance();
  const { stealthMode } = useSettings();
  const spendable = data ? { amount: spendableAmount(data).toFixed(2), currency: data.total.currency } : null;
  return (
    <View style={styles.row}>
      <Text color="textSecondary" style={styles.rowLabel}>Pay from</Text>
      <Text style={styles.rowValue}>
        {spendable ? `Spendable balance (${stealthMode ? hiddenMoney(spendable.currency) : formatMoney(spendable)})` : 'Spendable balance'}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: '94%',
  },
  sheetContent: { gap: spacing.lg },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.textDisabled,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topSpacer: { width: 24 },
  headline: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  center: { textAlign: 'center' },
  wrap: Platform.select({ web: { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object, default: {} }),
  recipient: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg,
    borderRadius: radii.md, backgroundColor: colors.bgSurfaceAlt,
  },
  recipientIcon: {
    width: 40, height: 40, borderRadius: radii.pill, backgroundColor: colors.accentPinkMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  recipientText: { flex: 1, minWidth: 0, gap: spacing.xxs },
  details: {
    gap: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  totalRow: { paddingTop: spacing.sm, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  rowLabel: { flexShrink: 0, maxWidth: '45%' },
  rowValue: {
    flex: 1, minWidth: 0, textAlign: 'right',
    ...Platform.select({ web: { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object, default: {} }),
  },
  pinSheet: { gap: spacing.lg, paddingBottom: spacing.md },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  waitingText: { flex: 1 },
  actions: {
    gap: spacing.md,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
}));
