import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, type ColorToken, type Palette } from '@/theme';

type Tone = 'primary' | 'secondary' | 'success';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  // primary: pink with white text. secondary: MiniPay's white pill with dark text (dark pill, white text in light mode).
  tone?: Tone;
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
};

// Read when drawn, so the buttons follow the theme.
const TONES: Record<Tone, (c: Palette) => { bg: string; pressed: string; fg: ColorToken }> = {
  primary: (c) => ({ bg: c.accentPink, pressed: c.accentPinkDeep, fg: 'textOnAccent' }),
  secondary: (c) => ({ bg: c.buttonSecondary, pressed: c.textSecondary, fg: 'buttonSecondaryText' }),
  // A finished action ("Copied"): green, so it reads as done at a glance.
  success: (c) => ({ bg: c.success, pressed: c.success, fg: 'textOnLight' }),
};

export function PillButton({ label, tone = 'primary', size = 'md', icon, disabled, loading, style, ...rest }: Props) {
  const t = TONES[tone](colors);
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      style={(state) => [
        styles.pill,
        size === 'sm' && styles.small,
        {
          backgroundColor: state.pressed ? t.pressed : t.bg,
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: state.pressed ? 0.98 : 1 }],
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={colors[t.fg]} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={t.fg} /> : null}
          <Text variant={size === 'sm' ? 'label' : 'bodyStrong'} color={t.fg}>
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    minHeight: 40,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
