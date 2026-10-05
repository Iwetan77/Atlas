import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AssetStats, Money } from '@/api/contract';
import { useAssetStats } from '@/api/markets';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatCompactMoney, formatMoney } from '@/format/money';
import { colors, radii, spacing } from '@/theme';

export function AssetMarketStats({ assetId }: { assetId: string }) {
  const { stats, loading } = useAssetStats(assetId);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}><Icon name="stats-chart-outline" size={16} color="accentPinkTint" /></View>
        <Text variant="label">Market details</Text>
      </View>
      <View style={styles.row}>
        <Metric label="Market cap" value={stats?.marketCap} loading={loading} />
        <View style={styles.divider} />
        <Metric label="24h volume" value={stats?.volume24h} loading={loading} />
      </View>
      <View style={styles.rule} />
      <View style={styles.row}>
        <Metric label="Liquidity" value={stats?.liquidity} loading={loading} />
        <View style={styles.divider} />
        <Address key={assetId + ':' + (stats?.tokenAddress?.address ?? '')}
          token={stats?.tokenAddress} loading={loading} />
      </View>
    </View>
  );
}

function Metric({ label, value, loading }: { label: string; value?: Money | null; loading: boolean }) {
  return (
    <View style={styles.cell}>
      <Text variant="caption" color="textSecondary">{label}</Text>
      <Text variant={value ? 'heading' : 'caption'} color={value ? 'textPrimary' : 'textSecondary'}
        numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}
        accessibilityLabel={value ? label + ' ' + formatMoney(value) : undefined}>
        {value ? formatCompactMoney(value) : loading ? 'Loading…' : 'Not available'}
      </Text>
    </View>
  );
}

function Address({ token, loading }: { token?: AssetStats['tokenAddress']; loading: boolean }) {
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); };
  }, []);
  const address = token?.address;
  const copy = async () => {
    if (!address || state === 'copying') return;
    if (timer.current) clearTimeout(timer.current);
    setState('copying');
    try {
      if (!await Clipboard.setStringAsync(address)) throw new Error('Copy failed');
      if (!mounted.current) return;
      setState('copied');
      timer.current = setTimeout(() => setState('idle'), 2000);
    } catch { if (mounted.current) setState('failed'); }
  };
  const short = address && (address.length > 13 ? address.slice(0, 5) + '…' + address.slice(-4) : address);
  return (
    <View style={styles.cell}>
      <Text variant="caption" color="textSecondary">
        {token?.kind === 'coinType' ? 'Coin address' : 'Token address'}
      </Text>
      {address ? (
        <Pressable onPress={() => void copy()} disabled={state === 'copying'}
          accessibilityRole="button" accessibilityLabel={'Copy token address ' + address}
          accessibilityHint="Copies the full address"
          style={({ pressed }) => [styles.address, pressed && styles.pressed]}>
          <Text variant="label" color="accentPinkTint" numberOfLines={1} style={styles.addressText}>
            {state === 'copied' ? 'Copied' : short}
          </Text>
          <Icon name={state === 'copied' ? 'checkmark-outline' : 'copy-outline'} size={15} color="accentPinkTint" />
        </Pressable>
      ) : <Text variant="caption" color="textSecondary">{loading ? 'Loading…' : 'Not available'}</Text>}
      {state === 'failed' && <Text variant="caption" color="accentPinkTint" accessibilityLiveRegion="polite">
        Couldn’t copy. Try again.
      </Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md,
    gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.sm, backgroundColor: colors.accentPinkMuted },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  cell: { flex: 1, minWidth: 0, gap: spacing.xs, justifyContent: 'flex-start' },
  divider: { width: 1, backgroundColor: colors.border },
  rule: { height: 1, backgroundColor: colors.border },
  address: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 28, flexDirection: 'row',
    alignItems: 'center', gap: spacing.sm, borderRadius: radii.sm,
    backgroundColor: colors.accentPinkMuted, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  addressText: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
});
