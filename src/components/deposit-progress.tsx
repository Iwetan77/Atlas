import { ActivityIndicator, View } from 'react-native';

import type { DepositState } from '@/api/contract';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, themedStyles } from '@/theme';

// What the deposit is doing now, one line at a time.
const NOW: Partial<Record<DepositState, string>> = {
  processing: 'Received. Turning it into dollars…',
  done: 'In your balance',
};
const WAITING = 'Waiting for your deposit…';

const TROUBLE: Partial<Record<DepositState, string>> = {
  incomplete: 'Less than the minimum arrived. Send the rest to the same address and it will go through.',
  refunded: 'This deposit couldn’t be converted, so it was returned to your NEAR account.',
  failed: 'Something went wrong with this deposit. Contact support with the address above.',
};

// A deposit's progress as a single line that changes as it moves: spinning until it's in, then ticked.
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
  const done = state === 'done';
  const line = NOW[state] ?? WAITING;
  return (
    <View style={[styles.box, done && styles.done]} accessibilityLiveRegion="polite" accessibilityLabel={line}>
      {done ? (
        <Icon name="checkmark-circle" size={22} color="success" />
      ) : (
        <ActivityIndicator size="small" color={colors.accentPink} />
      )}
      <Text variant="bodyStrong" style={styles.flex}>
        {line}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bgSurfaceAlt,
  },
  done: {
    backgroundColor: colors.successDim,
  },
  trouble: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerDim,
  },
  flex: {
    flex: 1,
  },
}));
