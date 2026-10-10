
import { useState } from 'react';
import { enginePost } from '@/api/client';
import { errorMessage, useAtlasAuth } from '@/auth/context';

import { ActivityIndicator, Pressable, Switch, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useNotifications } from '@/notifications/context';
import { colors, radii, spacing, themedStyles } from '@/theme';

export function NotificationDeviceControl() {
  const { device } = useNotifications();
  const { getAccessToken } = useAtlasAuth();
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const test = async () => {
    if (testing) return;
    setTesting(true); setMessage(null);
    try {
      await enginePost('/v1/notifications/test', await getAccessToken(), {}, { timeoutMs: 15_000 });
      setMessage('Test queued. Check your device notifications in a few seconds.');
    } catch (e) { setMessage(errorMessage(e)); }
    finally { setTesting(false); }
  };
  return <View style={styles.block}>
    <View style={styles.row}><View style={styles.icon}><Icon name="notifications-outline" size={20} color="accentPinkTint" /></View>
      <View style={styles.text}><Text variant="bodyStrong">Notify me on this device</Text><Text variant="caption" color="textSecondary">{device.explanation}</Text></View>
      {device.busy ? <ActivityIndicator color={colors.accentPink} /> : device.enabled ? <Switch value onValueChange={() => void device.change(false)}
        trackColor={{ true: colors.accentPink }} thumbColor={colors.surfaceLight} {...({ activeThumbColor: colors.surfaceLight } as object)} accessibilityLabel="Turn off device notifications" />
        : device.available ? <Pressable accessibilityRole="button" onPress={() => void device.change(true)} style={styles.enable}><Text variant="label" color="accentPinkTint">Enable</Text></Pressable> : null}
    </View>
    {device.enabled ? <Pressable accessibilityRole="button" disabled={testing} onPress={() => void test()} style={styles.test}><Text variant="caption" color="accentPinkTint">{testing ? 'Queuing test…' : 'Send a test notification'}</Text></Pressable> : null}
    {message ? <Text variant="caption" color="textSecondary" accessibilityRole="alert">{message}</Text> : null}
    {device.error ? <Text variant="caption" color="danger">{device.error}</Text> : null}
  </View>;
}
const styles = themedStyles(() => ({
  test: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  block: { gap: spacing.sm }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 36, height: 36, borderRadius: radii.pill, backgroundColor: colors.accentPinkDim, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: spacing.xxs }, enable: { paddingHorizontal: spacing.sm, minHeight: 44, justifyContent: 'center' },
}));
