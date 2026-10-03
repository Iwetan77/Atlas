import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, type as typeScale } from '@/theme';

type Props = TextInputProps & {
  prefix?: React.ReactNode;
  clearable?: boolean;
  clearLabel?: string;
};

export function Field({ prefix, clearable, clearLabel = 'Clear search', style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const canClear = clearable && !!rest.value?.length && rest.editable !== false && !rest.readOnly;
  return (
    <Pressable
      accessible={false}
      focusable={false}
      disabled={rest.editable === false || rest.readOnly}
      onPress={() => input.current?.focus()}
      style={[styles.wrap, focused && styles.wrapFocused, canClear && styles.withClear]}>
      {/* The icon and padding focus the same input as the text area. */}
      {prefix ? (
        <View pointerEvents="none">
          {typeof prefix === 'string' ? (
            <Text variant="bodyStrong" color="textSecondary">
              {prefix}
            </Text>
          ) : (
            prefix
          )}
        </View>
      ) : null}
      <TextInput
        ref={input}
        placeholderTextColor={colors.textDisabled}
        selectionColor={colors.accentPink}
        cursorColor={colors.accentPink}
        underlineColorAndroid="transparent"
        style={[styles.input, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {canClear ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            rest.onChangeText?.('');
            input.current?.focus();
          }}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}>
          <View style={styles.clearIcon}><Icon name="close" size={16} color="textSecondary" /></View>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.bgSurface,
    borderRadius: radii.md,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing.lg,
  },
  wrapFocused: {
    borderColor: colors.textDisabled,
    backgroundColor: colors.bgSurfaceAlt,
  },
  withClear: {
    paddingRight: spacing.xs,
  },
  clear: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearIcon: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearPressed: {
    opacity: 0.65,
  },
  input: {
    flex: 1,
    minWidth: 0,
    ...typeScale.heading,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
    // Focus belongs to the rounded field, not a rectangle around its text.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
});
