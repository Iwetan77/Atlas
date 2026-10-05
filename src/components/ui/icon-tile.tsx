import { View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, themedStyles } from '@/theme';

const TILES = {
  pink: { bg: 'tilePink', ink: 'tilePinkInk' },
  blue: { bg: 'tileBlue', ink: 'tileBlueInk' },
} as const;

// Pastel rounded-square icon (MiniPay's Send cards).
export function IconTile({ icon, tone = 'pink', size = 56 }: { icon: IconName; tone?: keyof typeof TILES; size?: number }) {
  const t = TILES[tone];
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.26, backgroundColor: colors[t.bg] }]}>
      <Icon name={icon} size={size * 0.45} color={t.ink} />
    </View>
  );
}

// Marks a feature that isn't live yet, so nothing pretends to work.
export function SoonChip() {
  return (
    <View style={styles.soon}>
      <Text variant="label" color="accentPinkTint">
        Soon
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  soon: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDim,
  },
}));
