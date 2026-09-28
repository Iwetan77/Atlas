import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/theme';

export type Promo = {
  id: string;
  eyebrow?: string;
  icon?: IconName;
  title: string;
  body: string;
  cta?: string;
  onPress?: () => void;
};

// Generic slot at the bottom of Home for campaigns and announcements.
export function PromoBanner({ promo }: { promo: Promo }) {
  return (
    <Pressable disabled={!promo.onPress} onPress={promo.onPress} accessibilityRole={promo.onPress ? 'button' : undefined}>
      <Card style={styles.card}>
        <View style={styles.accent} />
        <View style={styles.accentIcon}>
          <Icon name={promo.icon ?? 'sparkles'} size={22} color="accentPink" />
        </View>
        {promo.eyebrow ? (
          <Text variant="overline" color="accentPinkTint">
            {promo.eyebrow}
          </Text>
        ) : null}
        <Text variant="heading">{promo.title}</Text>
        <Text color="textSecondary">{promo.body}</Text>
        {promo.cta ? (
          <View style={styles.cta}>
            <Text variant="label" color="accentPink">
              {promo.cta}
            </Text>
            <Icon name="arrow-forward" size={14} color="accentPink" />
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accentPinkDim,
  },
  accentIcon: {
    position: 'absolute',
    right: spacing.xl,
    top: spacing.xl,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
