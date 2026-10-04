import { StyleSheet, View } from 'react-native';

import { useAssetStats } from '@/api/markets';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatCompactMoney, formatMoney } from '@/format/money';
import { colors, radii, spacing } from '@/theme';

export function AssetMarketStats({ assetId }: { assetId: string }) {
  const { stats, loading } = useAssetStats(assetId);
  const cap = stats?.marketCap;
  return (
    <View style={styles.row}>
      <View style={styles.label}>
        <View style={styles.icon}><Icon name="stats-chart-outline" size={18} color="accentPinkTint" /></View>
        <View style={styles.copy}>
          <Text variant="label">Market cap</Text>
          <Text variant="caption" color="textSecondary">Coins in circulation</Text>
        </View>
      </View>
      <Text variant={cap ? 'heading' : 'caption'} color={cap ? 'textPrimary' : 'textSecondary'}
        accessibilityLabel={cap ? 'Market cap ' + formatMoney(cap) : undefined}>
        {cap ? formatCompactMoney(cap) : loading ? 'Loading…' : 'Not available'}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
    gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.lg },
  label: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copy: { gap: spacing.xxs },
  icon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.sm, backgroundColor: colors.accentPinkMuted },
});
