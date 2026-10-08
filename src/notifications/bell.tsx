
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useNotifications } from '@/notifications/context';
import { colors, radii, themedStyles } from '@/theme';

export function NotificationBell() {
  const { inbox } = useNotifications();
  return <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button"
    accessibilityLabel={'Notifications' + (inbox.unread ? ', ' + inbox.unread + ' unread' : '')} style={styles.button}>
    <Icon name="notifications-outline" size={24} color="textPrimary" />
    {inbox.unread ? <View style={styles.badge}><Text variant="caption" style={styles.count}>{inbox.unread > 9 ? '9+' : inbox.unread}</Text></View> : null}
  </Pressable>;
}
const styles = themedStyles(() => ({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative', borderRadius: radii.pill },
  badge: { position: 'absolute', top: 1, right: 0, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: radii.pill,
    backgroundColor: colors.accentPink, borderColor: colors.bgBase, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  count: { color: colors.textOnAccent, fontSize: 9, lineHeight: 12 },
}));
