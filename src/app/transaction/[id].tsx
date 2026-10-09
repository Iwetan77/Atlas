import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTransactionReceipt } from '@/api/transactions';
import { ShareImageSheet } from '@/components/share/share-image-sheet';
import { useShareImage } from '@/components/share/use-share-image';
import { ReceiptCard } from '@/components/transactions/receipt-card';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useSettings } from '@/settings/context';
import { colors, spacing, themedStyles } from '@/theme';

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { stealthMode } = useSettings();
  const { receipt, error, reload } = useTransactionReceipt(id);
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (value: string) => { await Clipboard.setStringAsync(value); setCopied(value); };
  // The card is captured at its own shape, however many lines it has.
  const card = useRef<View>(null);
  const [aspect, setAspect] = useState(0.6);
  const { share, sharing, menu } = useShareImage(card, aspect, `atlas-receipt-${id.slice(-8)}.png`, 'Share receipt');
  return <Screen>
    <BackHeader title="Receipt" />
    {error ? <><Text color="danger" variant="caption">{error}</Text><PillButton label="Refresh" tone="secondary" size="sm" onPress={reload} /></> : null}
    {receipt ? <>
      <ReceiptCard receipt={receipt} stealth={stealthMode} cardRef={card}
        onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (width > 0 && height > 0) setAspect(width / height); }} />
      {receipt.state === 'pending' ? <Text variant="caption" color="textSecondary">{receipt.stage === 'sign' ? 'This action is waiting for your approval. Return Home to finish it.' : receipt.stage === 'validate' ? 'This plan is waiting for confirmation.' : receipt.kind === 'offramp' ? 'Your money is on its way to the bank. This page updates when the bank is paid.' : 'Your transfer is still being checked. This page will update as it settles.'}</Text> : null}
      {receipt.error ? <Card variant="outlined"><Text color="danger" variant="caption">{receipt.error}</Text></Card> : null}
      <View style={styles.actions}>
        <View style={styles.action}><PillButton label="Share receipt" icon="share-outline" loading={sharing} disabled={stealthMode} onPress={() => void share()} /></View>
        <View style={styles.action}><PillButton label={copied === receipt.id ? 'Copied' : 'Copy reference'} icon={copied === receipt.id ? 'checkmark' : 'copy-outline'} tone="secondary" onPress={() => void copy(receipt.id)} /></View>
      </View>
      {stealthMode ? <Text variant="caption" color="textSecondary">Amounts are hidden. Show them to share this receipt.</Text> : null}
      {receipt.txIds.length ? <Card style={styles.details}>
        <Text variant="overline" color="textSecondary">On the network</Text>
        {receipt.txIds.map((tx, n) => <Pressable key={`${tx}:${n}`} onPress={() => void copy(tx)} style={[styles.hash, n > 0 && styles.hashDivider]} accessibilityRole="button" accessibilityLabel={`Copy transaction ${n + 1}`}><Text selectable variant="caption" color="textSecondary" style={styles.flex}>{tx}</Text><Icon name={copied === tx ? 'checkmark' : 'copy-outline'} color="accentPinkTint" size={16} /></Pressable>)}
      </Card> : null}
      <ShareImageSheet options={menu} title="Share receipt" />
    </> : !error ? <Text color="textSecondary">Loading transaction…</Text> : null}
  </Screen>;
}
// Long words (hashes, references, account names) wrap inside the card instead of running past it.
const wrap = Platform.select({ web: { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object, default: {} });
const styles = themedStyles(() => ({ details: { gap: spacing.md }, actions: { flexDirection: 'row', gap: spacing.md }, action: { flex: 1 }, flex: { flex: 1, minWidth: 0, ...wrap }, hash: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, hashDivider: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md } }));
