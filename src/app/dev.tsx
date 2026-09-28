import { PublicKey } from '@solana/web3.js';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatEther } from 'viem';

import { errorMessage, useAtlasAuth } from '@/auth/context';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { network } from '@/config';
import { basePublicClient, solanaConnection } from '@/signing/chains';
import { ActionCancelled, type ActionReport, useConfirmAndExecute } from '@/signing/confirm';
import { buildSigningTestPlan } from '@/signing/test-plan';
import { spacing } from '@/theme';

type Balances = { base: string; solana: string } | null;

// Testnet-only screen for the Phase 1 gate: who is signed in, their wallets, and the
// one-confirmation signing test.
export default function DevScreen() {
  const auth = useAtlasAuth();
  const confirmAndExecute = useConfirmAndExecute();
  const [balances, setBalances] = useState<Balances>(null);
  const [report, setReport] = useState<ActionReport | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<'test' | 'airdrop' | null>(null);

  const { base, solana } = auth.wallets;

  const refresh = useCallback(async () => {
    if (!base || !solana) return;
    try {
      const [wei, lamports] = await Promise.all([
        basePublicClient.getBalance({ address: base as `0x${string}` }),
        solanaConnection.getBalance(new PublicKey(solana)),
      ]);
      setBalances({ base: `${formatEther(wei)} ETH`, solana: `${lamports / 1e9} SOL` });
    } catch (e) {
      setStatus(`Balance check failed: ${errorMessage(e)}`);
    }
  }, [base, solana]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const airdrop = async () => {
    if (!solana) return;
    setBusy('airdrop');
    setStatus(null);
    try {
      const sig = await solanaConnection.requestAirdrop(new PublicKey(solana), 1e9);
      const latest = await solanaConnection.getLatestBlockhash();
      await solanaConnection.confirmTransaction({ signature: sig, ...latest }, 'confirmed');
      setStatus('Airdropped 1 devnet SOL');
      await refresh();
    } catch (e) {
      setStatus(`Airdrop failed (devnet faucet is rate-limited): ${errorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const runSigningTest = async () => {
    if (!base || !solana) return;
    setBusy('test');
    setStatus(null);
    setReport(null);
    try {
      const plan = await buildSigningTestPlan({ base, solana });
      setReport(await confirmAndExecute(plan));
      await refresh();
    } catch (e) {
      if (!(e instanceof ActionCancelled)) setStatus(`Signing test failed: ${errorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const rows: [string, string | null][] = [
    ['Network', network],
    ['Privy user', auth.userId],
    ['Email', auth.email],
    ['Phone', auth.phone],
    ['Solana wallet', solana],
    ['Base wallet', base],
    ['Balances', balances ? `${balances.solana} · ${balances.base}` : null],
  ];

  const passed = report && report.confirmations === 1 && report.walletPrompts === 0;

  return (
    <Screen>
      <BackHeader title="Developer" />
      <Card level="alt" style={styles.card}>
        {rows.map(([label, value]) => (
          <Pressable
            key={label}
            disabled={!value}
            onPress={() => value && Clipboard.setStringAsync(value)}
            style={styles.row}>
            <Text variant="caption" color="textSecondary">
              {label}
            </Text>
            <Text selectable variant="bodyStrong" color={value ? 'textPrimary' : 'textDisabled'}>
              {value ?? (label.endsWith('wallet') ? 'creating…' : '—')}
            </Text>
          </Pressable>
        ))}
      </Card>
      <Text variant="caption" color="textSecondary">
        Tap a row to copy it. Base Sepolia ETH for gas comes from a faucet; Solana devnet SOL from the button below.
      </Text>

      <Card style={styles.card}>
        <Text variant="heading">One-confirmation test</Text>
        <Text color="textSecondary">
          Signs a Base Sepolia and a Solana devnet transaction from one Confirm tap. Passes only with exactly one
          confirmation and zero wallet prompts.
        </Text>
        {report ? (
          <View style={styles.row}>
            <Text variant="heading" color={passed ? 'success' : 'danger'}>
              {passed ? 'PASS' : 'FAIL'}
            </Text>
            <Text>
              {report.transactions} signatures · {report.confirmations} confirmation
              {report.confirmations === 1 ? '' : 's'} · {report.walletPrompts} wallet prompts
            </Text>
            {report.sent.map((s) => (
              <Text key={s.id} selectable variant="caption" color="textSecondary">
                {s.chain}: {s.id}
              </Text>
            ))}
          </View>
        ) : null}
        <PillButton
          label="Run signing test"
          loading={busy === 'test'}
          disabled={!auth.walletsReady || busy !== null}
          onPress={runSigningTest}
        />
        <PillButton
          label="Airdrop 1 devnet SOL"
          tone="secondary"
          loading={busy === 'airdrop'}
          disabled={!solana || busy !== null}
          onPress={airdrop}
        />
      </Card>

      {status ? <Text color="textSecondary">{status}</Text> : null}

      <PillButton label="Sign out" tone="secondary" onPress={auth.logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  row: {
    gap: spacing.xxs,
  },
});
