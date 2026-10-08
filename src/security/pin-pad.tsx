import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePinKeyboard } from '@/security/pin-keyboard';
import { colors, radii, spacing, themedStyles } from '@/theme';

// Digits stay in this mounted keypad only: never device storage, receipts or logs.
type Props = {
  onComplete: (pin: string) => void; disabled?: boolean; resetKey?: number; label?: string;
};
export function PinPad(props: Props) { return <PinPadEntry key={props.resetKey ?? 0} {...props} />; }
function PinPadEntry({ onComplete, disabled = false, label = 'Payment PIN' }: Props) {
  const [digits, setDigits] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const submitted = useRef(false);
  // React may batch several taps/keystrokes before drawing. Keep the current entry synchronously.
  const entry = useRef('');
  const clear = () => { entry.current = ''; setDigits(''); submitted.current = false; };
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { entry.current = ''; setDigits(''); submitted.current = false; }
    });
    return () => subscription.remove();
  }, []);
  const press = (key: string) => {
    if (disabled || submitted.current) return;
    const next = key === 'Backspace' || key === 'delete'
      ? entry.current.slice(0, -1) : (entry.current + key).replace(/[^0-9]/g, '').slice(0, 4);
    entry.current = next;
    setDigits(next);
    if (next.length === 4) { submitted.current = true; entry.current = ''; setDigits(''); onComplete(next); }
  };
  usePinKeyboard(press, clear);
  return (
    <View style={styles.pad}>
      <View style={styles.dots} accessible accessibilityLabel={label + ', ' + digits.length + ' of 4 digits entered'}>
        {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.slot, digits.length > i && styles.slotFilled]}>
          <View style={[styles.dot, digits.length > i && styles.dotFilled]} />
        </View>)}
      </View>
      <View style={styles.keys}>
        {['1','2','3','4','5','6','7','8','9','blank','0','delete'].map((key) => key === 'blank'
          ? <View key={key} style={styles.keySpace} />
          : <Pressable key={key} disabled={disabled} accessibilityRole="button"
              accessibilityLabel={key === 'delete' ? 'Delete PIN digit' : key}
              onFocus={() => { if (Platform.OS !== 'web' || document.activeElement?.matches(':focus-visible')) setFocused(key); }} onBlur={() => setFocused(null)}
              onPress={() => press(key)}
              style={({ pressed }) => [styles.key, key === 'delete' && styles.deleteKey,
                focused === key && styles.focused, pressed && styles.pressed, disabled && styles.disabled]}>
              {key === 'delete' ? <Icon name="backspace-outline" size={23} color="textSecondary" />
                : <Text variant="title" style={styles.number}>{key}</Text>}
            </Pressable>)}
      </View>
    </View>
  );
}
const styles = themedStyles(() => ({
  pad: { alignItems: 'center', gap: 20, width: '100%' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  slot: { width: 50, height: 54, borderRadius: radii.md, backgroundColor: colors.bgTabBar,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  slotFilled: { backgroundColor: colors.accentPinkMuted, borderColor: colors.accentPinkTint },
  dot: { width: 9, height: 9, borderRadius: radii.pill, backgroundColor: colors.textDisabled },
  dotFilled: { backgroundColor: colors.accentPinkTint },
  keys: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', maxWidth: 288, justifyContent: 'space-between', rowGap: 10 },
  keySpace: { width: '30%', height: 54 },
  key: { width: '30%', height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgTabBar,
    ...Platform.select({ web: { outlineStyle: 'none', touchAction: 'manipulation', userSelect: 'none' } as object }) },
  deleteKey: { backgroundColor: 'transparent', borderColor: 'transparent' },
  focused: { borderColor: colors.accentPinkTint },
  pressed: { backgroundColor: colors.accentPinkMuted, borderColor: colors.accentPinkTint },
  number: { fontSize: 25, lineHeight: 32 },
  disabled: { opacity: 0.4 },
}));
