import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radii, spacing, themedStyles } from '@/theme';

type Props = ViewProps & {
  // filled: grey card on the grey page (default). outlined: page-colored with a thin edge, for
  // secondary blocks like Next steps. alt: one step lighter, for cards nested in cards.
  variant?: 'filled' | 'outlined' | 'alt';
};

export function Card({ variant = 'filled', style, ...rest }: Props) {
  return <View style={[styles.card, variantStyles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
});

const variantStyles = themedStyles(() => ({
  filled: { backgroundColor: colors.bgSurface },
  outlined: { backgroundColor: colors.bgBase, borderWidth: 1.5, borderColor: colors.border },
  alt: { backgroundColor: colors.bgSurfaceAlt },
}));
