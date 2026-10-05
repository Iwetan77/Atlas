import { View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, themedStyles } from '@/theme';

export type Step = {
  key: string;
  title: string;
  subtitle: string;
  done: boolean;
  action?: { label: string; onPress: () => void };
};

// Home checklist for new users; disappears once every step is done.
export function NextSteps({ steps }: { steps: Step[] }) {
  if (steps.every((s) => s.done)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card variant="outlined" style={styles.card}>
      <View style={styles.header}>
        <Text variant="bodyStrong">Next steps</Text>
        <View style={styles.count}>
          <Text variant="label" color="accentPinkTint">
            {doneCount} of {steps.length}
          </Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(doneCount / steps.length) * 100}%` }]} />
      </View>

      {steps.map((step, i) => (
        <View key={step.key} style={[styles.row, i > 0 && styles.rowDivider]}>
          <View style={[styles.check, step.done ? styles.checkDone : styles.checkTodo]}>
            {step.done ? <Icon name="checkmark" size={14} color="textOnAccent" /> : null}
          </View>
          <View style={styles.text}>
            <Text
              variant="bodyStrong"
              color={step.done ? 'textSecondary' : 'textPrimary'}
              style={step.done && styles.struck}>
              {step.title}
            </Text>
            <Text variant="caption" color="textSecondary">
              {step.subtitle}
            </Text>
          </View>
          {!step.done && step.action ? (
            <PillButton label={step.action.label} tone="secondary" size="sm" onPress={step.action.onPress} />
          ) : null}
        </View>
      ))}
    </Card>
  );
}

const styles = themedStyles(() => ({
  card: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  count: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDim,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgSurface,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accentPink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: colors.accentPink,
  },
  checkTodo: {
    borderWidth: 2,
    borderColor: colors.textSecondary,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
}));
