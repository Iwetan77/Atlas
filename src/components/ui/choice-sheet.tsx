import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, maxContentWidth, radii, spacing, themedStyles } from '@/theme';
import { useDesktop } from '@/web/use-desktop';

export type Choice = {
  key: string;
  title: string;
  subtitle: string;
  icon?: IconName;
  // Overlapping coin logos instead of an icon.
  logos?: { symbol: string; url: string | null }[];
  soon?: boolean;
  onPress?: () => void;
};

// The sheet behind Home's Deposit and Send: a title, and one tap per way the money can go.
export function ChoiceSheet({
  visible,
  onClose,
  title,
  accessory,
  choices,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  // Beside the title, e.g. the currency picker.
  accessory?: ReactNode;
  choices: Choice[];
}) {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, desktop && { justifyContent: 'center', padding: 32 }]} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, desktop && { borderRadius: 28, maxHeight: '85%', paddingTop: 24 }, { paddingBottom: insets.bottom + spacing.xl }]} onPress={() => {}}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text variant="title">{title}</Text>
            {accessory}
          </View>
          {choices.map((c) => (
            <Pressable
              key={c.key}
              disabled={c.soon}
              onPress={c.onPress}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!c.soon }}
              style={({ pressed }) => [styles.choice, pressed && styles.pressed]}>
              <View style={styles.iconWrap}>
                {c.logos ? (
                  <View style={styles.logos}>
                    {c.logos.map((l, i) => (
                      <View key={l.symbol} style={[styles.logo, i > 0 && styles.logoBack]}>
                        <AssetAvatar symbol={l.symbol} iconUrl={l.url} size={24} />
                      </View>
                    ))}
                  </View>
                ) : (
                  <Icon name={c.icon ?? 'cash-outline'} size={22} color="accentPinkTint" />
                )}
              </View>
              <View style={styles.choiceText}>
                <Text variant="bodyStrong" color={c.soon ? 'textSecondary' : 'textPrimary'}>
                  {c.title}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {c.subtitle}
                </Text>
              </View>
              {c.soon ? (
                <View style={styles.soon}>
                  <Text variant="caption" color="accentPinkTint">
                    Soon
                  </Text>
                </View>
              ) : (
                <Icon name="chevron-forward" size={18} color="textSecondary" />
              )}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    backgroundColor: colors.bgSurface,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.bgSurfaceAlt,
  },
  pressed: {
    opacity: 0.8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPinkMuted,
  },
  logos: {
    flexDirection: 'row',
  },
  logo: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.accentPinkMuted,
  },
  logoBack: {
    marginLeft: -9,
  },
  choiceText: {
    flex: 1,
    gap: spacing.xxs,
  },
  soon: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDim,
  },
}));
