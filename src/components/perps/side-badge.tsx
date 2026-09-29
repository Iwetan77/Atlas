import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

// LONG / SHORT with leverage, in the semantic gain/loss colours (never brand pink).
export function SideBadge({ side, leverage }: { side: 'long' | 'short'; leverage: number }) {
  const long = side === 'long';
  return (
    <View style={[styles.badge, { backgroundColor: long ? colors.successDim : colors.dangerDim }]}>
      <Text variant="label" color={long ? 'success' : 'danger'}>
        {long ? 'LONG' : 'SHORT'} {leverage}×
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
});
