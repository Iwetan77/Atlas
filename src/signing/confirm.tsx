import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ExecutionPlan, IntentKind, SentTx, SignedTx } from '@/api/contract';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { waitForTx } from '@/signing/chains';
import { friendlyTxError } from '@/signing/errors';
import { useSigner } from '@/signing/use-signer';
import { watchWalletPrompts } from '@/signing/wallet-prompts';
import { colors, maxContentWidth, radii, spacing } from '@/theme';

// What one user action actually cost, so the one-confirmation rule can be checked, not assumed.
export type ActionReport = {
  intentId: string;
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
  resolve: (r: ActionReport) => void;
  reject: (e: Error) => void;
};

type Phase = { kind: 'review' } | { kind: 'signing'; step: number } | { kind: 'error'; message: string };

const TITLES: Record<IntentKind, string> = {
  buy: 'Confirm purchase',
  sell: 'Confirm sale',
  send: 'Confirm send',
  off_ramp: 'Confirm withdrawal',
  perp_open: 'Confirm position',
  perp_close: 'Close position',
  yield_deposit: 'Confirm deposit',
};

const ConfirmContext = createContext<((plan: ExecutionPlan) => Promise<ActionReport>) | null>(null);

export function useConfirmAndExecute() {
  const run = useContext(ConfirmContext);
  if (!run) throw new Error('useConfirmAndExecute must be used inside <ConfirmProvider>');
  return run;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const signer = useSigner();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<Pending | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'review' });
  const confirmations = useRef(0);

  const confirmAndExecute = useCallback((plan: ExecutionPlan) => {
    return new Promise<ActionReport>((resolve, reject) => {
      confirmations.current = 0;
      setPhase({ kind: 'review' });
      setPending({ plan, resolve, reject });
    });
  }, []);

  const close = () => setPending(null);

  const cancel = () => {
    pending?.reject(new ActionCancelled());
    close();
  };

  const confirm = async () => {
    if (!pending || phase.kind === 'signing') return;
    const { plan } = pending;
    confirmations.current += 1;
    const stopWatching = watchWalletPrompts();
    const sent: SentTx[] = [];
    const signed: SignedTx[] = [];
    try {
      for (const [index, tx] of plan.transactions.entries()) {
        setPhase({ kind: 'signing', step: index + 1 });
        if (tx.chain === 'solana' && tx.submit === 'engine') {
          signed.push({ index, transaction: await signer.sign(tx) });
          continue;
        }
        const result = await signer.send(tx);
        await waitForTx(result);
        sent.push(result);
      }
      pending.resolve({
        intentId: plan.intentId,
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
  const expired = !!plan && Date.now() > plan.expiresAtUnixMs;

  return (
    <ConfirmContext.Provider value={confirmAndExecute}>
      {children}
      <Modal visible={!!pending} transparent animationType="slide" onRequestClose={cancel}>
        <Pressable style={styles.backdrop} onPress={phase.kind === 'review' ? cancel : undefined}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={styles.grabber} />
            {plan ? (
              <>
                <Text variant="title">{TITLES[plan.kind]}</Text>
                <View style={styles.summary}>
                  {plan.summary.map((row) => (
                    <View key={row.label} style={styles.row}>
                      <Text color="textSecondary">{row.label}</Text>
                      <Text variant="bodyStrong">{row.value}</Text>
                    </View>
                  ))}
                </View>

                {phase.kind === 'review' ? (
                  <View style={styles.actions}>
                    {expired ? <Text color="danger">This quote expired. Go back and try again.</Text> : null}
                    <PillButton label="Confirm" disabled={expired || !signer.ready} onPress={confirm} />
                    <PillButton label="Cancel" tone="secondary" onPress={cancel} />
                  </View>
                ) : null}

                {phase.kind === 'signing' ? (
                  <View style={styles.progress}>
                    <ActivityIndicator color={colors.accentPink} />
                    <Text color="textSecondary">
                      {plan.transactions.length > 1
                        ? `Working on it… step ${phase.step} of ${plan.transactions.length}`
                        : 'Working on it…'}
                    </Text>
                  </View>
                ) : null}

                {phase.kind === 'error' ? (
                  <View style={styles.actions}>
                    <Text color="danger">{phase.message}</Text>
                    <PillButton label="Close" tone="secondary" onPress={failAfterError} />
                  </View>
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

const styles = StyleSheet.create({
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
    gap: spacing.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.textDisabled,
  },
  summary: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  actions: {
    gap: spacing.md,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
});
