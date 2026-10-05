import { useState } from 'react';
import { Image, Linking, Modal, Pressable, View } from 'react-native';

import { useAndroidUpdate } from '@/api/app-update';
import { readDeviceValue, writeDeviceValue } from '@/auth/device-session';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { colors, spacing, themedStyles } from '@/theme';

const DISMISSED = 'atlas.updateDismissed';

// Home's note that a newer Android app is out. "Later" hides it until the next version.
export function UpdateBanner() {
  const update = useAndroidUpdate();
  const [dismissed, setDismissed] = useState(() => readDeviceValue(DISMISSED));
  if (!update || update.required || dismissed === update.latest) return null;
  return (
    <Card style={styles.banner}>
      <View style={styles.row}>
        <Icon name="arrow-down-circle-outline" size={22} color="accentPinkTint" />
        <View style={styles.text}>
          <Text variant="bodyStrong">{`Atlas ${update.latest} is ready`}</Text>
          <Text variant="caption" color="textSecondary">Download it and install it over this app. Your account stays as it is.</Text>
        </View>
        <Pressable
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Later"
          onPress={() => { writeDeviceValue(DISMISSED, update.latest); setDismissed(update.latest); }}>
          <Icon name="close" size={20} color="textSecondary" />
        </Pressable>
      </View>
      <PillButton label="Update Atlas" size="sm" onPress={() => void Linking.openURL(update.downloadUrl)} />
    </Card>
  );
}

// When this app is older than the engine still supports, nothing else can work: only the update.
export function UpdateGate() {
  const update = useAndroidUpdate();
  if (!update?.required) return null;
  return (
    <Modal visible animationType="none" onRequestClose={() => {}} statusBarTranslucent>
      <View style={styles.gate}>
        <Image source={require('../../assets/images/icon.png')} style={styles.logo} accessibilityLabel="Atlas" />
        <Text variant="title" style={styles.center}>Update Atlas to continue</Text>
        <Text color="textSecondary" style={styles.center}>
          {`This version no longer works. Download Atlas ${update.latest} and install it over this app; your account and money stay as they are.`}
        </Text>
        <PillButton label="Download the update" onPress={() => void Linking.openURL(update.downloadUrl)} style={styles.button} />
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  banner: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  text: { flex: 1, gap: spacing.xxs },
  gate: { flex: 1, backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  logo: { width: 88, height: 88, borderRadius: 24 },
  center: { textAlign: 'center', maxWidth: 340 },
  button: { alignSelf: 'stretch', maxWidth: 340, width: '100%' },
}));
