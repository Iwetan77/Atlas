import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, themedStyles } from '@/theme';

export type ShareImageOptions = {
  visible: boolean;
  preparing: boolean;
  ready: boolean;
  preview: string | null;
  error: string | null;
  canShare: boolean;
  onClose: () => void;
  onRetry: () => void;
  onShare: () => void;
  onDownload: () => void;
};

// Prepare before offering the system sheet: Safari requires sharing from a fresh tap.
export function ShareImageSheet({ options }: { options: ShareImageOptions }) {
  const insets = useSafeAreaInsets();
  return <Modal visible={options.visible} transparent animationType="slide" onRequestClose={options.onClose}>
    <Pressable style={styles.backdrop} onPress={options.onClose} accessibilityLabel="Close share options">
      <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]} onPress={() => {}}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="title">Share your card</Text>
          {options.preview ? <Image source={{ uri: options.preview }} style={styles.preview} contentFit="contain" accessibilityLabel="Your share card preview" /> : null}
          {options.preparing ? <View style={styles.progress}><ActivityIndicator color={colors.accentPink} /><Text color="textSecondary">Preparing your image…</Text></View> : null}
          {options.error ? <><Text color="danger" accessibilityRole="alert">{options.error}</Text>
            {!options.ready ? <PillButton label="Try again" tone="secondary" onPress={options.onRetry} /> : null}</> : null}
          <PillButton label="Download image" icon="download-outline" disabled={!options.ready} onPress={options.onDownload} />
          {options.canShare ? <PillButton label="Share image" icon="share-outline" tone="secondary" disabled={!options.ready} onPress={options.onShare} /> : null}
          <PillButton label="Cancel" tone="secondary" onPress={options.onClose} />
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>;
}
const styles = themedStyles(() => ({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: spacing.lg },
  sheet: { alignSelf: 'center', width: '100%', maxWidth: 440, maxHeight: '92%', borderRadius: radii.lg, backgroundColor: colors.bgSurface },
  content: { padding: spacing.xl, gap: spacing.md },
  preview: { width: '100%', aspectRatio: 1.5, borderRadius: radii.md },
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
}));
