import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/theme';

export type Promo = {
  id: string;
  eyebrow?: string;
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
        {promo.eyebrow ? (
          <Text variant="label" color="accentPinkTint">
            {promo.eyebrow}
          </Text>
        ) : null}
        <Text variant="heading">{promo.title}</Text>
        <Text color="textSecondary">{promo.body}</Text>
        {promo.cta ? (
          <Text variant="label" color="accentPink">
            {promo.cta} ›
          </Text>
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
    right: -40,
    top: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accentPinkDim,
  },
});
