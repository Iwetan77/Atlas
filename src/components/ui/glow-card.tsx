import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type ViewProps } from 'react-native';

import { colors, gradients, radii, spacing } from '@/theme';

// The hero surface (balance card): pink light falling off into black, with a pink edge.
export function GlowCard({ style, children, ...rest }: ViewProps) {
  return (
    <LinearGradient
      colors={gradients.balance}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.card, style]}
      {...rest}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.accentPink,
    padding: spacing.xl,
    overflow: 'hidden',
  },
});
