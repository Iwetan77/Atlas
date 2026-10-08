
import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { NotificationDeviceControl } from '@/notifications/device-control';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { type MoneyNotice, useNotifications } from '@/notifications/context';
import { colors, radii, spacing, themedStyles } from '@/theme';

export default function NotificationsScreen() {
  const { inbox, loading, error, reload, read, more } = useNotifications();
  const [actionError, setActionError] = useState<string | null>(null);
  const open = async (n: MoneyNotice) => {
    setActionError(null);
    try { await read(n.id); } catch { setActionError('Could not mark this update as read.'); }
    router.push((n.url || '/') as Href);
  };
  return <Screen refreshing={loading && inbox.items.length > 0} onRefresh={reload}>
    <BackHeader title="Notifications" />
    <View style={styles.heading}><Text color="textSecondary">Your money, at a glance.</Text>
      {inbox.unread ? <Pressable accessibilityRole="button" onPress={() => void read().catch(() => setActionError('Could not mark updates as read.'))}>
        <Text variant="label" color="accentPinkTint">Mark all read</Text>
      </Pressable> : null}
    </View>
    <Card><NotificationDeviceControl /></Card>
    {error || actionError ? <Text variant="caption" color="danger">{actionError || error}</Text> : null}
    {!inbox.items.length ? <Card style={styles.empty}>
      <View style={styles.emptyIcon}><Icon name="notifications-outline" size={28} color="accentPinkTint" /></View>
      <Text variant="bodyStrong">{loading ? 'Checking your updates…' : 'You’re all caught up'}</Text>
      <Text color="textSecondary" style={styles.emptyText}>Money in and out, trades and perps alerts will appear here.</Text>
    </Card> : <View style={styles.list}>{inbox.items.map((n) => <Pressable key={n.id} accessibilityRole="button"
      accessibilityLabel={n.title + (n.read ? '' : ', unread')} onPress={() => void open(n)}
      style={[styles.notice, !n.read && styles.unread]}>
      <View style={[styles.icon, n.warning && styles.warning]}><Icon name={n.warning ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={22} color={n.warning ? 'danger' : 'accentPinkTint'} /></View>
      <View style={styles.content}><View style={styles.title}><Text variant="bodyStrong" style={styles.titleText}>{n.title}</Text>{!n.read ? <View style={styles.dot} /> : null}</View>
        <Text variant="caption" color="textSecondary">{n.body}</Text>
        <Text variant="caption" color="textSecondary" style={styles.time}>{new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      <Icon name="chevron-forward" size={16} color="textSecondary" />
    </Pressable>)}</View>}
    {inbox.hasMore ? <Pressable onPress={() => void more()} accessibilityRole="button" style={styles.more}><Text color="accentPinkTint">Earlier updates</Text></Pressable> : null}
  </Screen>;
}
const styles = themedStyles(() => ({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }, emptyText: { textAlign: 'center', maxWidth: 280 },
  emptyIcon: { width: 58, height: 58, borderRadius: radii.lg, backgroundColor: colors.accentPinkDim, alignItems: 'center', justifyContent: 'center' },
  list: { gap: spacing.sm }, notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    backgroundColor: colors.bgSurface, borderRadius: radii.lg, borderWidth: 1, borderColor: 'transparent' },
  unread: { borderColor: colors.accentPinkMuted }, icon: { width: 40, height: 40, borderRadius: radii.md,
    backgroundColor: colors.accentPinkDim, alignItems: 'center', justifyContent: 'center' }, warning: { backgroundColor: colors.dangerDim },
  content: { flex: 1, gap: spacing.xs }, title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, titleText: { flex: 1 },
  dot: { width: 6, height: 6, borderRadius: radii.pill, backgroundColor: colors.accentPink }, time: { fontSize: 10 },
  more: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
}));
