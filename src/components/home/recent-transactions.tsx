import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTransactions } from '@/api/transactions';
import { TransactionList } from '@/components/transactions/transaction-list';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';

// `refreshKey`: bumped by Home's pull-to-refresh to load the latest.
export function RecentTransactions({ stealth, refreshKey = 0 }: { stealth: boolean; refreshKey?: number }) {
  const { data, error, reload } = useTransactions(3);
  useEffect(() => {
    if (refreshKey > 0) void reload();
  }, [refreshKey, reload]);
  return <View style={styles.section}>
    <View style={styles.header}>
      <View style={styles.label}><Icon name="time-outline" size={14} color="textSecondary" /><Text variant="overline" color="textSecondary">Transactions</Text></View>
      <Pressable onPress={() => router.push('/transactions')} hitSlop={10} accessibilityRole="button"><Text variant="label" color="accentPinkTint">See more</Text></Pressable>
    </View>
    {data?.length ? <TransactionList rows={data.slice(0, 3)} stealth={stealth} /> : <Card>
      <Text variant="caption" color="textSecondary">{error ? 'History couldn’t load. Try refreshing in a moment.' : data ? 'Your buys, sells and money moves will show up here.' : 'Loading your activity…'}</Text>
      {error ? <Pressable onPress={() => void reload()} hitSlop={10}><Text variant="label" color="accentPinkTint">Try again</Text></Pressable> : null}
    </Card>}
    {data?.length && error ? <Text variant="caption" color="textSecondary">Showing your last update. Tap See more to refresh.</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: spacing.sm }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, label: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm } });
