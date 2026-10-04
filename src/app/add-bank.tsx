import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { bankTransferStatus, openBankTransfer, quoteBankTransfer } from '@/api/bank-transfer';
import type { BankTransfer, BankTransferQuote, BankTransferState } from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { MoneyError } from '@/components/money-error';
import { ResultView } from '@/components/result-view';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatExactMoney, formatMoney } from '@/format/money';
import { useAddMoney } from '@/funding/add-money';
import { useSettings } from '@/settings/context';
import { colors, radii, spacing } from '@/theme';

const PROGRESS: Record<BankTransferState, string> = {
  waiting: 'Waiting for your transfer',
  received: 'Transfer received',
  processing: 'Adding it to your balance',
  review: 'This payment is being checked',
  completed: 'Added to your balance',
  failed: 'This transfer didn’t go through',
  expired: 'This account has expired',
};
const FINAL: BankTransferState[] = ['completed', 'failed', 'expired'];

// Add money from any Nigerian bank: a one-time account for an exact amount, and what's
// paid into it lands in the balance as dollars.
export default function AddByBankScreen() {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const openAddMoney = useAddMoney();
  const [naira, setNaira] = useState('');
  const [quote, setQuote] = useState<{ naira: string; quote: BankTransferQuote } | null>(null);
  const [quoteError, setQuoteError] = useState<{ naira: string; message: string } | null>(null);
  const [transfer, setTransfer] = useState<BankTransfer | null>(null);
  const [opening, setOpening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Opened from the Add money sheet: leaving before an account opens goes back to that list.
  const opened = useRef(false);
  useEffect(
    () => () => {
      if (from === 'add-money' && !opened.current) openAddMoney();
    },
    [from, openAddMoney],
  );

  // Whole naira only: the one-time accounts take a whole-naira amount.
  const amount = String(Math.floor(Number(naira) || 0));
  const ready = Number(amount) > 0;

  // A preview as the amount settles; nothing opens until the button is pressed.
  useEffect(() => {
    if (!ready || transfer) return;
    let live = true;
    const id = setTimeout(() => {
      quoteBankTransfer(getAccessToken, amount, displayCurrency).then(
        (q) => live && setQuote({ naira: amount, quote: q }),
        (e) => live && setQuoteError({ naira: amount, message: errorMessage(e) }),
      );
    }, 400);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [ready, amount, displayCurrency, getAccessToken, transfer]);
  const preview = quote?.naira === amount ? quote.quote : null;
  const previewError = quoteError?.naira === amount ? quoteError.message : null;

  // Follow the account until the money is in, and count down its lock.
  useEffect(() => {
    if (!transfer || FINAL.includes(transfer.state)) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        setTransfer(await bankTransferStatus(getAccessToken, transfer.id, displayCurrency));
      } catch {
        // A missed check is retried on the next tick.
      }
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [transfer, getAccessToken, displayCurrency]);

  const open = async () => {
    setOpening(true);
    setProblem(null);
    try {
      setTransfer(await openBankTransfer(getAccessToken, amount, displayCurrency));
      opened.current = true;
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setOpening(false);
    }
  };

  const copy = async (key: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
  };

  if (transfer?.state === 'completed') {
    return (
      <ResultView title={`${formatMoney(transfer.receive)} added`} subtitle="It’s in your balance now.">
        <PillButton label="Done" onPress={() => router.navigate('/')} />
      </ResultView>
    );
  }

  const secondsLeft = transfer ? Math.max(0, Math.floor((transfer.expiresAtUnixMs - now) / 1000)) : 0;
  const waiting = transfer?.state === 'waiting';

  return (
    <Screen>
      <BackHeader title="Bank transfer" />
      {!transfer ? (
        <>
          <AmountInput label="How much do you want to add?" value={naira} onChange={setNaira} currency="NGN" />
          {preview ? (
            <Card style={styles.card}>
              {/* What's typed is what lands; the fees go on top of the transfer. */}
              <Row label="You transfer" value={formatMoney(preview.pay)} strong />
              <Row label="You get" value={formatMoney(preview.receive)} />
              <Row label="Fee (1%, up to ₦100)" value={formatMoney(preview.fee)} />
              {/* A flat charge for sending the dollars to your wallet, whatever the amount. */}
              <Row label="Delivery to your wallet" value={preview.networkFee} />
              <Row label="Rate" value={preview.rate} />
            </Card>
          ) : null}
          {preview && preview.receive.currency === 'NGN' && Number(preview.pay.amount) > 0 && 1 - Number(preview.receive.amount) / Number(preview.pay.amount) > 0.05 ? (
            <Text variant="caption" color="textSecondary">
              About {Math.round((1 - Number(preview.receive.amount) / Number(preview.pay.amount)) * 100)}% of the transfer goes to
              fees here. Most of it is the flat delivery charge, so larger amounts pay a much smaller share.
            </Text>
          ) : null}
          {previewError ? <Text color="danger">{previewError}</Text> : null}
          {problem ? <MoneyError message={problem} /> : null}
          <PillButton label="Get account details" loading={opening} disabled={!preview || opening} onPress={open} />
          <Text variant="caption" color="textSecondary">
            You’ll get a one-time account for this exact amount. The rate is locked for about 20 minutes.
          </Text>
        </>
      ) : (
        <Card style={styles.card}>
          <Text variant="label" color="textSecondary">
            Transfer exactly
          </Text>
          <CopyLine
            value={formatExactMoney(transfer.pay)}
            big
            copied={copied === 'amount'}
            onCopy={() => copy('amount', transfer.pay.amount)}
          />
          <Text variant="label" color="textSecondary">
            To
          </Text>
          <CopyLine
            value={transfer.accountNumber}
            copied={copied === 'account'}
            onCopy={() => copy('account', transfer.accountNumber)}
          />
          <Text variant="bodyStrong">{transfer.bankName}</Text>
          <Text color="textSecondary">{transfer.accountName}</Text>
          <View style={styles.divider} />
          <Row label="You get" value={formatMoney(transfer.receive)} strong />
          <View style={styles.status}>
            <Icon
              name={transfer.state === 'failed' || transfer.state === 'expired' ? 'alert-circle' : 'time-outline'}
              size={18}
              color={transfer.state === 'failed' || transfer.state === 'expired' ? 'danger' : 'textSecondary'}
            />
            <Text variant="bodyStrong">{PROGRESS[transfer.state]}</Text>
          </View>
          {transfer.message ? <Text color="textSecondary">{transfer.message}</Text> : null}
          {waiting ? (
            <Text variant="caption" color={secondsLeft < 300 ? 'danger' : 'textSecondary'}>
              {secondsLeft > 0
                ? `Send it within ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}.`
                : 'The time to send has run out. Don’t send to this account.'}{' '}
              Send the exact amount from your own bank account. A different amount is sent back to you (from
              Fidelity Bank, it fails).
            </Text>
          ) : null}
          {transfer.state === 'failed' || transfer.state === 'expired' ? (
            <PillButton label="Start again" tone="secondary" onPress={() => setTransfer(null)} />
          ) : null}
        </Card>
      )}
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text color="textSecondary">{label}</Text>
      <Text variant={strong ? 'bodyStrong' : 'body'}>{value}</Text>
    </View>
  );
}

function CopyLine({ value, big, copied, onCopy }: { value: string; big?: boolean; copied: boolean; onCopy: () => void }) {
  return (
    <Pressable
      onPress={onCopy}
      accessibilityRole="button"
      accessibilityLabel={`Copy ${value}`}
      style={({ pressed }) => [styles.copy, pressed && styles.pressed]}>
      <Text selectable variant={big ? 'title' : 'heading'} style={styles.copyText}>
        {value}
      </Text>
      <Icon name={copied ? 'checkmark-circle' : 'copy-outline'} size={20} color={copied ? 'success' : 'textSecondary'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bgSurfaceAlt,
  },
  copyText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
