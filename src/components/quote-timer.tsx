import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, themedStyles } from '@/theme';

// Under a quote: how long the price is held, and a small pink button for a fresh price now (for
// anyone who doesn't like this one). No button while the quote is being used.
export function QuoteTimer({ text, onReload, busy }: { text: string; onReload?: () => void; busy?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" color="textSecondary" style={styles.text}>
        {text}
      </Text>
      {onReload ? (
        <Pressable
          onPress={onReload}
          disabled={busy}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Get a new price"
          style={({ pressed }) => [styles.button, (pressed || busy) && styles.dim]}>
          <Icon name="refresh" size={15} color="accentPink" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    flex: 1,
  },
  button: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPinkDim,
  },
  dim: {
    opacity: 0.5,
  },
}));
