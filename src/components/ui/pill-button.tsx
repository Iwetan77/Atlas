import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  tone?: 'primary' | 'secondary';
};

export function PillButton({ label, tone = 'primary', disabled, style, ...rest }: Props) {
  const primary = tone === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.pill,
        {
          backgroundColor: primary
            ? state.pressed
              ? colors.accentPinkTint
              : colors.accentPink
            : state.pressed
              ? colors.border
              : colors.bgSurfaceAlt,
          opacity: disabled ? 0.4 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <Text variant="bodyStrong" color={primary ? 'textOnAccent' : 'textPrimary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
