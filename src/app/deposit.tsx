import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import QRCodeStyled from 'react-native-qrcode-styled';

import { engineGet, enginePost, SAFE_TO_REPLAY } from '@/api/client';
import type { DepositAddress, DepositNetwork, DepositState } from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { MoneyError } from '@/components/money-error';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { SelectSheet } from '@/components/ui/select-sheet';
import { Text } from '@/components/ui/text';
import { network } from '@/config';
import { formatMoney } from '@/format/money';
import { useSettings } from '@/settings/context';
import { colors, radii, spacing } from '@/theme';

// Base and Solana USDC go straight to the user's own wallets; every other network gets a one-off
// deposit address that turns what arrives into USDC in the balance.
// Solana first: cash there never needs Atlas to pay gas.
const OWN: { id: 'base' | 'solana'; label: string; network: string }[] = [
  { id: 'solana', label: network === 'mainnet' ? 'USDC on Solana' : 'USDC on Solana devnet (testnet)', network: 'Solana' },
  { id: 'base', label: network === 'mainnet' ? 'USDC on Base' : 'USDC on Base Sepolia (testnet)', network: 'Base' },
];

const STATE_TEXT: Record<DepositState, string> = {
  waiting: 'Waiting for your deposit…',
  processing: 'It arrived. Adding it to your balance…',
  done: 'Done. It’s in your balance.',
  incomplete: 'Less than the minimum arrived. Send the rest to the same address.',
  refunded: 'This deposit couldn’t be converted, so it was returned to your NEAR account.',
  failed: 'Something went wrong with this deposit. Contact support with the address below.',
};

// Receive money from a wallet or an exchange, on the network the user picks. Chain names show only
// here, because sending on the wrong network is how people lose money.
export default function DepositScreen() {
  const { wallets, getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const [networks, setNetworks] = useState<DepositNetwork[]>([]);
  const [picked, setPicked] = useState<string>('solana');
  const [amount, setAmount] = useState('');
  const [deposit, setDeposit] = useState<DepositAddress | null>(null);
  const [state, setState] = useState<DepositState>('waiting');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getAccessToken()
      .then((token) => engineGet<{ networks: DepositNetwork[] }>('/v1/deposit/networks', token))
      .then((r) => setNetworks(r.networks))
      .catch(() => setNetworks([]));
  }, [getAccessToken]);

  // Follow a deposit address until the money is in the balance.
  useEffect(() => {
    if (!deposit || state === 'done' || state === 'refunded' || state === 'failed') return;
    const id = setInterval(async () => {
      try {
        const query = `address=${encodeURIComponent(deposit.address)}${deposit.memo ? `&memo=${encodeURIComponent(deposit.memo)}` : ''}`;
        const r = await engineGet<{ state: DepositState }>(`/v1/deposit/status?${query}`, await getAccessToken());
        setState(r.state);
      } catch {
        // A missed check is retried on the next tick.
      }
    }, 5000);
    return () => clearInterval(id);
  }, [deposit, state, getAccessToken]);

  const own = OWN.find((o) => o.id === picked);
  const other = networks.find((n) => n.id === picked);
  const address = own ? wallets[own.id] : deposit?.address;

  const choose = (id: string) => {
    setPicked(id);
    setDeposit(null);
    setProblem(null);
    setState('waiting');
  };

  const getAddress = async () => {
    if (!other) return;
    setBusy(true);
    setProblem(null);
    try {
      const d = await enginePost<DepositAddress>(
        '/v1/deposit/quote',
        await getAccessToken(),
        { networkId: other.id, amount: { amount: (Number(amount) || 0).toFixed(2), currency: displayCurrency } },
        SAFE_TO_REPLAY,
      );
      setDeposit(d);
      setState('waiting');
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Screen>
      <BackHeader title="Wallet or exchange" />
      <SelectSheet
        title="Which network are you sending on?"
        value={picked}
        onChange={choose}
        items={[
          ...OWN.map((o) => ({ key: o.id, label: o.label, detail: 'Straight to your Atlas wallet' })),
          ...networks.map((n) => ({ key: n.id, label: n.label, detail: 'Arrives as dollars in your balance' })),
        ]}
      />

      {other && !deposit ? (
        <Card style={styles.card}>
          <AmountInput label={`How much ${other.asset} will you send?`} value={amount} onChange={setAmount} currency={displayCurrency} />
          {problem ? <MoneyError message={problem} /> : null}
          <PillButton label="Get deposit address" loading={busy} disabled={!(Number(amount) > 0)} onPress={getAddress} />
        </Card>
      ) : null}

      {address && (own || deposit) ? (
        <Card style={styles.card}>
          {deposit ? (
            <>
              <Text variant="heading">
                Send {deposit.sendAmount} {deposit.asset} on {deposit.network}
              </Text>
              <Text color="textSecondary">
                Anything from {deposit.minAmount} {deposit.asset} counts. You’ll get about {formatMoney(deposit.receive)}
                {deposit.timeEstimateSec ? `, usually within ${Math.max(1, Math.round(deposit.timeEstimateSec / 60))} min of it arriving` : ''}.
              </Text>
            </>
          ) : (
            <Text variant="bodyStrong">{own?.label}</Text>
          )}
          <View style={styles.qr}>
            <QRCodeStyled
              data={address}
              pieceSize={5}
              padding={12}
              color={colors.bgBase}
              outerEyesOptions={{ borderRadius: 6, color: colors.accentPink }}
              innerEyesOptions={{ borderRadius: 3, color: colors.bgBase }}
            />
          </View>
          <Text selectable variant="caption" style={styles.address}>
            {address}
          </Text>
          {deposit?.memo ? (
            <Text selectable variant="bodyStrong" style={styles.address}>
              Memo (required): {deposit.memo}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <PillButton label={copied ? 'Copied' : 'Copy'} onPress={() => copy(address)} style={styles.action} />
            <PillButton label="Share" tone="secondary" onPress={() => Share.share({ message: address })} style={styles.action} />
          </View>
          {deposit ? (
            <Text color={state === 'done' ? 'success' : state === 'failed' || state === 'refunded' ? 'danger' : 'textSecondary'}>
              {STATE_TEXT[state]}
            </Text>
          ) : null}
          <Text variant="caption" color="textSecondary">
            Only send {deposit ? `${deposit.asset} on ${deposit.network}` : own?.label} to this address. Anything else may be lost.
            {deposit ? ' Use it within 2 hours of getting it.' : ''}
          </Text>
        </Card>
      ) : own ? (
        <Text color="textSecondary">Setting up your wallet…</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  qr: {
    alignSelf: 'center',
    backgroundColor: colors.qrBackground,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  address: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
