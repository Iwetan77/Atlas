import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radii, spacing, type as typeScale } from '@/theme';

type Props = TextInputProps & {
  prefix?: React.ReactNode;
};

export function Field({ prefix, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  return (
    <Pressable
      accessible={false}
      focusable={false}
      disabled={rest.editable === false || rest.readOnly}
      onPress={() => input.current?.focus()}
      style={[styles.wrap, { borderColor: focused ? colors.accentPink : colors.bgSurface }]}>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radii.md,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    ...typeScale.heading,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
    // The pink border already shows focus; drop the browser's default outline.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
});
