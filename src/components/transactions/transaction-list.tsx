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
  const symbol = r.symbol?.trim() || (r.kind === 'deposit' ? r.title.match(/^Deposit\s+([A-Z0-9]+)/i)?.[1] : null);
  if (symbol || r.iconUrl) {
    return <View style={styles.assetLogo}>
      <AssetAvatar symbol={symbol || 'USDC'} iconUrl={r.iconUrl} size={40} />
      {r.kind === 'deposit' || r.kind === 'onramp' ? <View style={styles.incoming}>
        <Icon name="arrow-down" color="tilePinkInk" size={12} />
      </View> : null}
    </View>;
  }
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
  assetLogo: { width: 40, height: 40 },
  incoming: { position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.bgSurface, backgroundColor: colors.tilePink, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 40, height: 40, borderRadius: radii.pill, backgroundColor: colors.accentPinkDim, alignItems: 'center', justifyContent: 'center' },
});
