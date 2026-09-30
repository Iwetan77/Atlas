import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useEarn } from '@/api/earn';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatMoney, HIDDEN } from '@/format/money';
import { colors, radii, spacing } from '@/theme';

// Earn on Home: the rate on offer, or what's already earning. One tap to the savings screen.
export function EarnCard({ stealth }: { stealth: boolean }) {
  const { options, positions, reload } = useEarn();
  // Home stays mounted under the tabs; coming back from Savings should show the new amount.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const option = options?.[0];
  if (!option) return null;
  const earning = positions?.find((p) => p.optionId === option.optionId);

  return (
    <View style={styles.section}>
      <Text variant="overline" color="textSecondary">
        Earn
      </Text>
      <Pressable onPress={() => router.push('/earn')} accessibilityRole="button">
        {({ pressed }) => (
          <Card style={[styles.card, pressed && styles.pressed]}>
            <View style={styles.icon}>
              <Icon name="leaf-outline" size={22} color="accentPinkTint" />
            </View>
            <View style={styles.text}>
              {earning ? (
                <>
                  <Text variant="bodyStrong">{stealth ? HIDDEN : formatMoney(earning.value)} earning</Text>
                  <Text variant="caption" color="textSecondary">
                    {option.name} · {earning.apyPct}% a year
                  </Text>
                </>
              ) : (
                <>
                  <Text variant="bodyStrong">Earn {option.apyPct}% a year on your cash</Text>
                  <Text variant="caption" color="textSecondary">
                    Savings with {option.venue}. Take it out any time.
                  </Text>
                </>
              )}
            </View>
            <Icon name="chevron-forward" size={18} color="accentPink" />
          </Card>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.8,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
});
