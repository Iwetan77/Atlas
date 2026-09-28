import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  tone?: 'primary' | 'secondary';
  icon?: IconName;
  loading?: boolean;
};

export function PillButton({ label, tone = 'primary', icon, disabled, loading, style, ...rest }: Props) {
  const primary = tone === 'primary';
  const inactive = disabled || loading;
  const fg = primary ? 'textOnAccent' : 'textPrimary';
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
          transform: [{ scale: state.pressed ? 0.98 : 1 }],
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={primary ? colors.textOnAccent : colors.accentPink} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Text variant="bodyStrong" color={fg}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 52,
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
