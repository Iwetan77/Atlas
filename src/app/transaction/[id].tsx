import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { engineGet } from '@/api/client';
import { receiptDate, receiptState, type TransactionReceipt } from '@/api/transactions';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { TransactionLogo } from '@/components/transactions/transaction-list';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney, HIDDEN } from '@/format/money';
import { useSettings } from '@/settings/context';
import { colors, spacing } from '@/theme';

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency, stealthMode } = useSettings();
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true; let busy = false;
    // Changing retry restarts this focused subscription.
    const requestRound = retry;
    async function refresh() {
      if (busy) return; busy = true;
      try {
        const next = await engineGet<TransactionReceipt>(`/v1/transactions/${encodeURIComponent(id)}?currency=${displayCurrency}`, await getAccessToken(), { timeoutMs: 15000 });
        if (active && requestRound === retry) { setReceipt(next); setError(null); }
      } catch (e) { if (active) setError(errorMessage(e)); }
      finally { busy = false; }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 10000);
    return () => { active = false; clearInterval(timer); };
  }, [id, displayCurrency, getAccessToken, retry]));
  const copy = async (value: string) => { await Clipboard.setStringAsync(value); setCopied(value); };
  return <Screen>
    <BackHeader title="Transaction" />
    {error ? <><Text color="danger" variant="caption">{error}</Text><PillButton label="Refresh" tone="secondary" size="sm" onPress={() => setRetry((n) => n + 1)} /></> : null}
    {receipt ? <>
      <Card style={styles.hero}>
        <TransactionLogo receipt={receipt} /><Text variant="heading">{receipt.title}</Text>
        {receipt.amount ? <Text variant="title">{stealthMode ? HIDDEN : formatMoney(receipt.amount)}</Text> : null}
        <Text variant="label" color={receipt.state === 'filled' ? 'success' : receipt.state === 'failed' ? 'danger' : 'accentPinkTint'}>{receiptState(receipt)}</Text>
        <Text variant="caption" color="textSecondary">{receiptDate(receipt.createdAtUnixMs)}</Text>
      </Card>
      {receipt.state === 'pending' ? <Text variant="caption" color="textSecondary">{receipt.stage === 'sign' ? 'This action is waiting for your approval. Return Home to finish it.' : receipt.stage === 'validate' ? 'This plan is waiting for confirmation.' : 'Your transfer is still being checked. This page will update as it settles.'}</Text> : null}
      {receipt.error ? <Card variant="outlined"><Text color="danger" variant="caption">{receipt.error}</Text></Card> : null}
      {receipt.summary.length ? <Card style={styles.details}><Text variant="overline" color="textSecondary">Your confirmation</Text>{receipt.summary.map((line, n) => <View style={styles.line} key={`${line.label}:${n}`}><Text variant="caption" color="textSecondary" style={styles.flex}>{line.label}</Text><Text variant="label" style={styles.summaryValue}>{stealthMode ? HIDDEN : line.value}</Text></View>)}</Card> : null}
      <Card style={styles.details}>
        <Text variant="overline" color="textSecondary">Transaction IDs</Text>
        {receipt.txIds.length ? receipt.txIds.map((tx, n) => <Pressable key={`${tx}:${n}`} onPress={() => void copy(tx)} style={styles.hash} accessibilityRole="button" accessibilityLabel={`Copy transaction ${n + 1}`}><Text selectable variant="caption" style={styles.flex}>{tx}</Text><Icon name={copied === tx ? 'checkmark' : 'copy-outline'} color="accentPinkTint" size={18} /></Pressable>) : <Text variant="caption" color="textSecondary">No transaction ID reported yet.</Text>}
        <Pressable onPress={() => void copy(receipt.id)} style={styles.hash}><Text variant="caption" color="textSecondary" style={styles.flex}>Reference: {receipt.id}</Text><Icon name={copied === receipt.id ? 'checkmark' : 'copy-outline'} color="accentPinkTint" size={16} /></Pressable>
      </Card>
    </> : !error ? <Text color="textSecondary">Loading transaction…</Text> : null}
  </Screen>;
}
const styles = StyleSheet.create({ hero: { alignItems: 'center', gap: spacing.md }, details: { gap: spacing.lg }, line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }, flex: { flex: 1 }, summaryValue: { flex: 1, textAlign: 'right' }, hash: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md } });
