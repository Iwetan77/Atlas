import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radii, spacing } from '@/theme';

type Props = ViewProps & {
  // Nested cards (e.g. the asset breakdown) sit one step higher.
  level?: 'surface' | 'alt';
};

export function Card({ level = 'surface', style, ...rest }: Props) {
  return (
    <View
      style={[styles.card, { backgroundColor: level === 'alt' ? colors.bgSurfaceAlt : colors.bgSurface }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
});
