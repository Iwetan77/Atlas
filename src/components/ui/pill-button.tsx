import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  tone?: 'primary' | 'secondary';
  loading?: boolean;
};

export function PillButton({ label, tone = 'primary', disabled, loading, style, ...rest }: Props) {
  const primary = tone === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      style={(state) => [
        styles.pill,
        {
          backgroundColor: primary
            ? state.pressed
              ? colors.accentPinkTint
              : colors.accentPink
            : state.pressed
              ? colors.accentPinkDim
              : colors.bgBase,
          borderColor: primary ? 'transparent' : colors.accentPink,
          opacity: disabled ? 0.4 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={primary ? colors.textOnAccent : colors.accentPink} />
      ) : (
        <Text variant="bodyStrong" color={primary ? 'textOnAccent' : 'textPrimary'}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 50,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
