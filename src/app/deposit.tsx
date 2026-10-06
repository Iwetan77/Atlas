import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import QRCodeStyled from 'react-native-qrcode-styled';

import { engineGet, enginePost, SAFE_TO_REPLAY } from '@/api/client';
import type { DepositAddress, DepositJourney as Journey, DepositNetwork, DepositState } from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { MoneyError } from '@/components/money-error';
import { BackHeader } from '@/components/ui/back-header';
import { DepositJourney } from '@/components/deposit-journey';
import { DepositProgress } from '@/components/deposit-progress';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { TokenChainLogo } from '@/components/token-chain-logo';
import { SelectSheet } from '@/components/ui/select-sheet';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/format/money';
import { useAddMoney } from '@/funding/add-money';
import { useSettings } from '@/settings/context';
import { colors, radii, spacing, themedStyles } from '@/theme';

// Base and Solana USDC go straight to the user's own wallets; every other network gets a one-off
// deposit address that turns what arrives into USDC in the balance.
const LOGOS = 'https://cdn.layerswap.io/layerswap';
const OWN: { id: 'base' | 'solana'; label: string; network: string; chainIcon: string }[] = [
  { id: 'solana', label: 'USDC on Solana', network: 'Solana', chainIcon: `${LOGOS}/networks/solana_mainnet.png` },
  { id: 'base', label: 'USDC on Base', network: 'Base', chainIcon: `${LOGOS}/networks/base_mainnet.png` },
];

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
  const [journey, setJourney] = useState<Journey | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { from } = useLocalSearchParams<{ from?: string }>();
  const openAddMoney = useAddMoney();

  // Opened from the Add money sheet: leaving goes back to that list, not to Home.
  useEffect(
    () => () => {
      if (from === 'add-money') openAddMoney();
    },
    [from, openAddMoney],
  );

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
        const r = await engineGet<{ state: DepositState; journey?: Journey }>(
          `/v1/deposit/status?${query}`,
          await getAccessToken(),
        );
        setState(r.state);
        if (r.journey) setJourney(r.journey);
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
    setJourney(null);
  };

  const getAddress = async () => {
    if (!other) return;
    setBusy(true);
    setProblem(null);
    try {
      const d = await enginePost<DepositAddress>(
        '/v1/deposit/quote',
        await getAccessToken(),
        // What's typed is what lands; the coin to send carries the fees on top.
        { networkId: other.id, amount: { amount: (Number(amount) || 0).toFixed(2), currency: displayCurrency }, receive: true },
        SAFE_TO_REPLAY,
      );
      setDeposit(d);
      setState('waiting');
      setJourney(null);
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
        moreLabel="More networks and coins"
        items={[
          ...OWN.map((o) => ({
            key: o.id,
            label: o.label,
            detail: 'Straight to your Atlas wallet',
            leadingNode: <TokenChainLogo symbol="USDC" iconUrl={null} chainIconUrl={o.chainIcon} />,
          })),
          ...networks.map((n) => ({
            key: n.id,
            label: n.label,
            detail: n.asset === 'USDC' || n.asset === 'USDT' ? 'Arrives as dollars in your balance' : 'Turned into dollars in your balance',
            leadingNode: <TokenChainLogo symbol={n.asset} iconUrl={n.assetIcon} chainIconUrl={n.chainIcon} />,
            more: n.featured === false,
          })),
        ]}
      />

      {other && !deposit ? (
        <Card style={styles.card}>
          <AmountInput label="How much do you want to add?" value={amount} onChange={setAmount} currency={displayCurrency} />
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
              {/* What the move costs, plainly: what's sent less what lands. On small deposits the fixed
                  fees are a big share. */}
              {deposit.sendValue && deposit.sendValue.currency === deposit.receive.currency &&
              Number(deposit.sendValue.amount) > Number(deposit.receive.amount) ? (
                <Text variant="caption" color="textSecondary">
                  Fees, included in what you send: about{' '}
                  {formatMoney({
                    amount: String(Number(deposit.sendValue.amount) - Number(deposit.receive.amount)),
                    currency: deposit.receive.currency,
                  })}
                  {(Number(deposit.sendValue.amount) - Number(deposit.receive.amount)) / Number(deposit.sendValue.amount) > 0.05
                    ? '. They’re mostly fixed, so bigger deposits pay a smaller share.'
                    : ''}
                </Text>
              ) : null}
            </>
          ) : (
            <Text variant="bodyStrong">{own?.label}</Text>
          )}
          <View style={styles.qr}>
            <QRCodeStyled
              data={address}
              pieceSize={5}
              padding={12}
              // Always dark on the white card, in both themes (the page colour vanished in light mode).
              color={colors.textOnLight}
              outerEyesOptions={{ borderRadius: 6, color: colors.accentPink }}
              innerEyesOptions={{ borderRadius: 3, color: colors.textOnLight }}
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
            <PillButton
              label={copied ? 'Copied' : 'Copy'}
              icon={copied ? 'checkmark-circle' : 'copy-outline'}
              tone={copied ? 'success' : 'primary'}
              onPress={() => copy(address)}
              style={styles.action}
            />
            <PillButton label="Share" tone="secondary" onPress={() => Share.share({ message: address })} style={styles.action} />
          </View>
          {deposit ? <DepositProgress state={state} /> : null}
          {deposit ? <DepositJourney journey={journey} network={deposit.network} /> : null}
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

const styles = themedStyles(() => ({
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
}));
