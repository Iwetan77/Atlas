import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import QRCodeStyled from 'react-native-qrcode-styled';

import { engineGet, enginePost } from '@/api/client';
import type { BankDepositAccount, OnrampSession } from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { network } from '@/config';
import { colors, radii, spacing } from '@/theme';

type Rail = 'base' | 'solana';

// Crypto deposits land straight in the user's own embedded wallets; these are the only screens
// where a chain name is shown, because sending on the wrong network is how people lose funds.
const RAILS: Record<Rail, { tab: string; label: string }> = {
  base: { tab: 'Base', label: network === 'mainnet' ? 'USDC on Base' : 'USDC on Base Sepolia (testnet)' },
  solana: { tab: 'Solana', label: network === 'mainnet' ? 'USDC on Solana' : 'USDC on Solana devnet (testnet)' },
};

export default function DepositScreen() {
  const { wallets, getAccessToken } = useAtlasAuth();
  const [rail, setRail] = useState<Rail>('base');
  const [bank, setBank] = useState<BankDepositAccount | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    getAccessToken()
      .then((token) => engineGet<BankDepositAccount>('/v1/deposit/bank-account', token))
      .then(setBank)
      .catch((e) => setBankError(errorMessage(e)));
  }, [getAccessToken]);

  const copy = async (value: string, what: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const payWithCard = async () => {
    setCardLoading(true);
    setCardError(null);
    try {
      const token = await getAccessToken();
      const session = await enginePost<OnrampSession>('/v1/onramp/session', token, { chain: 'base' });
      await WebBrowser.openBrowserAsync(session.widgetUrl);
    } catch (e) {
      setCardError(errorMessage(e));
    } finally {
      setCardLoading(false);
    }
  };

  const address = wallets[rail];

  return (
    <Screen>
      <BackHeader title="Deposit" />

      <Card style={styles.card}>
        <Text variant="heading">Bank transfer (NGN)</Text>
        {bank ? (
          <>
            <Row label="Bank" value={bank.bankName} />
            <Row label="Account name" value={bank.accountName} />
            <Pressable onPress={() => copy(bank.accountNumber, 'account')}>
              <Row label="Account number" value={bank.accountNumber} />
              <Text variant="caption" color="accentPinkTint">
                {copied === 'account' ? 'Copied' : 'Tap to copy'}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text color="textSecondary">
            {bankError ? 'Naira bank deposits aren’t available yet.' : 'Loading your account details…'}
          </Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Card</Text>
        <Text color="textSecondary">Buy USDC with a card through Circle.</Text>
        {cardError ? <Text color="danger">Card deposits aren’t available yet.</Text> : null}
        <PillButton label="Pay with card" tone="secondary" loading={cardLoading} onPress={payWithCard} />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Send crypto</Text>
        <View style={styles.tabs}>
          {(Object.keys(RAILS) as Rail[]).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRail(r)}
              style={[
                styles.tab,
                r === rail
                  ? { backgroundColor: colors.accentPinkDim, borderColor: colors.accentPink }
                  : { borderColor: colors.border },
              ]}>
              <Text variant="label" color={r === rail ? 'accentPinkTint' : 'textSecondary'}>
                {RAILS[r].tab}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text variant="bodyStrong">{RAILS[rail].label}</Text>
        {address ? (
          <>
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
            <View style={styles.actions}>
              <PillButton
                label={copied === 'address' ? 'Copied' : 'Copy'}
                onPress={() => copy(address, 'address')}
                style={styles.action}
              />
              <PillButton
                label="Share"
                tone="secondary"
                onPress={() => Share.share({ message: address })}
                style={styles.action}
              />
            </View>
            <Text variant="caption" color="textSecondary">
              Only send {RAILS[rail].label} to this address. Anything else may be lost.
            </Text>
          </>
        ) : (
          <Text color="textSecondary">Setting up your wallet…</Text>
        )}
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text color="textSecondary">{label}</Text>
      <Text variant="bodyStrong" selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
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
