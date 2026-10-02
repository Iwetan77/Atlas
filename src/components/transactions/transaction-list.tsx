import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { receiptDate, receiptState, type TransactionReceipt } from '@/api/transactions';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatMoney, HIDDEN } from '@/format/money';
import { colors, radii, spacing } from '@/theme';

export function TransactionLogo({ receipt: r }: { receipt: TransactionReceipt }) {
  if (r.symbol || r.iconUrl) return <AssetAvatar symbol={r.symbol || 'USDC'} iconUrl={r.iconUrl} size={40} />;
  const icons: Record<string, IconName> = { deposit: 'arrow-down-outline', onramp: 'card-outline', offramp: 'business-outline', send: 'arrow-up-outline', cashlink: 'link-outline', earn_deposit: 'leaf-outline', earn_withdraw: 'leaf-outline', perp_open: 'trending-up-outline', perp_close: 'trending-down-outline' };
  return <View style={styles.logo}><Icon name={icons[r.kind] ?? 'swap-horizontal-outline'} color="accentPinkTint" size={20} /></View>;
}
export function TransactionList({ rows, stealth }: { rows: TransactionReceipt[]; stealth: boolean }) {
  return <Card style={styles.card}>{rows.map((r, index) => (
    <Pressable key={r.id} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: r.id } })}
      accessibilityRole="button" accessibilityLabel={`${r.title}, ${receiptState(r)}`}
      style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}>
      <TransactionLogo receipt={r} />
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>{r.title}</Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>{receiptDate(r.createdAtUnixMs)}</Text>
      </View>
      <View style={styles.value}>
        {r.amount ? <Text variant="label">{stealth ? HIDDEN : formatMoney(r.amount)}</Text> : null}
        <Text variant="caption" color={r.state === 'filled' ? 'success' : r.state === 'failed' ? 'danger' : 'accentPinkTint'}>{receiptState(r)}</Text>
      </View>
      <Icon name="chevron-forward" size={14} color="textSecondary" />
    </Pressable>
  ))}</Card>;
}
const styles = StyleSheet.create({
  card: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { opacity: 0.75 }, text: { flex: 1, gap: spacing.xs }, value: { alignItems: 'flex-end', gap: spacing.xs, maxWidth: '42%' },
  logo: { width: 40, height: 40, borderRadius: radii.pill, backgroundColor: colors.accentPinkDim, alignItems: 'center', justifyContent: 'center' },
});
