import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { DepositState } from '@/api/contract';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

const STEPS = ['Waiting for your deposit', 'Received, turning it into dollars', 'In your balance'] as const;

// Which step a deposit is on: 0 waiting, 1 converting, 2 done.
function stepOf(state: DepositState): number {
  if (state === 'done') return 2;
  if (state === 'processing') return 1;
  return 0;
}

const TROUBLE: Partial<Record<DepositState, string>> = {
  incomplete: 'Less than the minimum arrived. Send the rest to the same address and it will go through.',
  refunded: 'This deposit couldn’t be converted, so it was returned to your NEAR account.',
  failed: 'Something went wrong with this deposit. Contact support with the address above.',
};

// A deposit's progress as three steps: done ones ticked, the current one spinning.
export function DepositProgress({ state }: { state: DepositState }) {
  const trouble = TROUBLE[state];
  if (trouble) {
    return (
      <View style={[styles.box, styles.trouble]}>
        <Icon name="alert-circle" size={20} color="danger" />
        <Text color="danger" style={styles.flex}>
          {trouble}
        </Text>
      </View>
    );
  }
  const current = stepOf(state);
  return (
    <View style={styles.box} accessibilityLabel={STEPS[current]}>
      {STEPS.map((label, i) => {
        const done = i < current || state === 'done';
        const active = i === current && state !== 'done';
        return (
          <View key={label} style={styles.step}>
            <View style={styles.marker}>
              {done ? (
                <Icon name="checkmark-circle" size={22} color="success" />
              ) : active ? (
                <ActivityIndicator size="small" color={colors.accentPink} />
              ) : (
                <View style={styles.dot} />
              )}
            </View>
            <Text variant={active || (done && i === STEPS.length - 1) ? 'bodyStrong' : 'body'} color={done || active ? 'textPrimary' : 'textSecondary'}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bgSurfaceAlt,
  },
  trouble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerDim,
  },
  flex: {
    flex: 1,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  marker: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
  },
});
