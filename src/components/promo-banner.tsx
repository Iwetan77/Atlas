import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

export type Promo = {
  id: string;
  title: string;
  body: string;
  art?: IconName;
  cta?: { label: string; onPress: () => void };
};

// Generic campaign/announcement slot at the bottom of Home (MiniPay's "3 Years of MiniPay" card).
export function PromoBanner({ promo, onDismiss }: { promo: Promo; onDismiss?: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.art}>
        <Icon name={promo.art ?? 'sparkles'} size={72} color="tilePink" />
      </View>
      <View style={styles.titleRow}>
        <Text variant="heading" style={styles.title}>
          {promo.title}
        </Text>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss">
            <Icon name="close" size={22} color="textPrimary" />
          </Pressable>
        ) : null}
      </View>
      <Text color="textPrimary" style={styles.body}>
        {promo.body}
      </Text>
      {promo.cta ? (
        <PillButton label={promo.cta.label} tone="secondary" size="sm" onPress={promo.cta.onPress} style={styles.cta} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.accentPinkDim,
    overflow: 'hidden',
  },
  art: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.sm,
    opacity: 0.9,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: {
    flex: 1,
  },
  body: {
    opacity: 0.85,
    maxWidth: '78%',
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
});
