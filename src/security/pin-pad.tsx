import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

// Digits stay in this mounted field only: never device storage, receipts or logs.
type Props = {
  onComplete: (pin: string) => void; disabled?: boolean; resetKey?: number; label?: string;
};
export function PinPad(props: Props) { return <PinPadEntry key={props.resetKey ?? 0} {...props} />; }
function PinPadEntry({ onComplete, disabled = false, label = 'Payment PIN' }: Props) {
  const [digits, setDigits] = useState('');
  const input = useRef<TextInput>(null);
  const submitted = useRef(false);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { setDigits(''); submitted.current = false; }
    });
    return () => subscription.remove();
  }, []);
  const change = (raw: string) => {
    if (disabled || submitted.current) return;
    const next = raw.replace(/[^0-9]/g, '').slice(0, 4);
    setDigits(next);
    if (next.length === 4) { submitted.current = true; setDigits(''); onComplete(next); }
  };
  return (
    <View style={styles.pad}>
      <Pressable style={styles.dots} onPress={() => input.current?.focus()} accessibilityLabel={label}>
        {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.dot, digits.length > i && styles.dotFilled]} />)}
        <TextInput ref={input} value={digits} onChangeText={change} secureTextEntry maxLength={4}
          inputMode="numeric" keyboardType="number-pad" showSoftInputOnFocus={false} autoComplete="off"
          textContentType="none" autoCorrect={false} contextMenuHidden caretHidden editable={!disabled}
          accessibilityLabel={label} style={[styles.input, Platform.OS === 'web' && { outlineWidth: 0 } as object]} />
      </Pressable>
      <View style={styles.keys}>
        {['1','2','3','4','5','6','7','8','9','blank','0','delete'].map((key) => key === 'blank'
          ? <View key={key} style={styles.key} />
          : <Pressable key={key} disabled={disabled} accessibilityRole="button"
              accessibilityLabel={key === 'delete' ? 'Delete PIN digit' : key}
              onPress={() => change(key === 'delete' ? digits.slice(0,-1) : digits + key)}
              style={({ pressed }) => [styles.key, pressed && styles.pressed, disabled && styles.disabled]}>
              {key === 'delete' ? <Icon name="backspace-outline" size={24} /> : <Text variant="title">{key}</Text>}
            </Pressable>)}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  pad: { alignItems: 'center', gap: spacing.lg, width: '100%' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, height: 44, width: 220 },
  dot: { width: 15, height: 15, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.textSecondary },
  dotFilled: { backgroundColor: colors.accentPink, borderColor: colors.accentPink },
  input: { position: 'absolute', width: '100%', height: '100%', opacity: 0.01, color: 'transparent' },
  keys: { flexDirection: 'row', flexWrap: 'wrap', width: 284, gap: spacing.sm },
  key: { width: 89, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  pressed: { backgroundColor: colors.bgSurfaceAlt },
  disabled: { opacity: 0.4 },
});
