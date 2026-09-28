import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

export type Step = {
  key: string;
  title: string;
  subtitle: string;
  done: boolean;
  onPress?: () => void;
};

// Home checklist for new users; disappears once every step is done.
export function NextSteps({ steps }: { steps: Step[] }) {
  if (steps.every((s) => s.done)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="heading">Next steps</Text>
        <Text variant="label" color="textSecondary">
          {doneCount}/{steps.length}
        </Text>
      </View>
      {steps.map((step) => (
        <Pressable
          key={step.key}
          disabled={step.done || !step.onPress}
          onPress={step.onPress}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.accentPinkDim }]}>
          <View
            style={[
              styles.check,
              step.done
                ? { backgroundColor: colors.accentPink, borderColor: colors.accentPink }
                : { borderColor: colors.border },
            ]}>
            {step.done ? (
              <Text variant="label" color="textOnAccent">
                ✓
              </Text>
            ) : null}
          </View>
          <View style={styles.text}>
            <Text variant="bodyStrong" color={step.done ? 'textSecondary' : 'textPrimary'}>
              {step.title}
            </Text>
            <Text variant="caption" color="textSecondary">
              {step.subtitle}
            </Text>
          </View>
          {!step.done && step.onPress ? (
            <Text variant="heading" color="accentPink">
              ›
            </Text>
          ) : null}
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
});
