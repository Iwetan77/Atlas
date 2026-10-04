import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { setPin } from '@/api/pin';
import { claimHandle, HANDLE_RE, normaliseHandle } from '@/api/send';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { PinPad } from '@/security/pin-pad';
import { colors, radii, spacing } from '@/theme';

export function PinSetup({ handle: initialHandle, onDone, change = false, onCancel }: {
  handle: string | null; onDone: () => void; change?: boolean; onCancel?: () => void;
}) {
  const { getAccessToken, logout } = useAtlasAuth();
  const [handle, setHandle] = useState(initialHandle);
  const [rawHandle, setRawHandle] = useState('');
  const [stage, setStage] = useState<'current' | 'new' | 'repeat'>(change ? 'current' : 'new');
  const [current, setCurrent] = useState('');
  const [first, setFirst] = useState('');
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const name = normaliseHandle(rawHandle);
  const saveHandle = async () => {
    if (busy) return;
    setBusy(true); setProblem(null);
    try { const me = await claimHandle(getAccessToken, name); setHandle(me.handle); }
    catch (e) { setProblem(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const enter = async (pin: string) => {
    if (busy) return;
    setProblem(null);
    if (stage === 'current') { setCurrent(pin); setStage('new'); setReset((n) => n+1); return; }
    if (stage === 'new') { setFirst(pin); setStage('repeat'); setReset((n) => n+1); return; }
    if (first !== pin) {
      setFirst(''); setStage('new'); setReset((n) => n+1);
      setProblem('Those PINs did not match. Choose your PIN again.'); return;
    }
    setBusy(true);
    try { await setPin(getAccessToken, first, pin, change ? current : undefined); setCurrent(''); setFirst(''); onDone(); }
    catch (e) { setProblem(errorMessage(e)); setCurrent(''); setFirst(''); setStage(change ? 'current' : 'new'); setReset((n) => n+1); }
    finally { setBusy(false); }
  };
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.brand}><Icon name="shield-checkmark-outline" size={25} color="accentPinkTint" /></View>
          <Text variant="overline" color="accentPinkTint">{change ? 'ACCOUNT SECURITY' : 'MAKE ATLAS YOURS'}</Text>
          <Text variant="title">{!handle ? 'Choose your @handle' : stage === 'current' ? 'Your current PIN' : stage === 'repeat' ? 'Enter it once more' : change ? 'Choose a new PIN' : 'Protect your money'}</Text>
          <Text color="textSecondary">{!handle
            ? 'Friends can send money straight to your @handle. Next, we will set up your payment PIN.'
            : stage === 'repeat' ? 'Repeat your four digits to make sure you remember them.'
            : stage === 'current' ? 'Enter the PIN you use today before changing it.'
            : 'Choose four digits you can remember. Use them whenever you send, buy, sell or move money.'}</Text>
          {!handle ? <>
            <Field prefix="@" placeholder="yourname" value={rawHandle} onChangeText={setRawHandle}
              autoCapitalize="none" autoCorrect={false} maxLength={21} accessibilityLabel="Your handle" />
            <Text variant="caption" color="textSecondary">3–20 letters, numbers or underscores. Your handle is permanent.</Text>
            <PillButton label="Continue" loading={busy} disabled={!HANDLE_RE.test(name)} onPress={saveHandle} />
          </> : <>
            <PinPad label={stage === 'repeat' ? 'Repeat payment PIN' : stage === 'current' ? 'Current payment PIN' : 'New payment PIN'}
              resetKey={reset} disabled={busy} onComplete={enter} />
            {busy ? <ActivityIndicator color={colors.accentPink} /> : null}
            {stage === 'repeat' && !busy ? <Pressable onPress={() => { setFirst(''); setStage('new'); setReset((n) => n+1); }}>
              <Text variant="label" color="accentPinkTint">Choose a different PIN</Text>
            </Pressable> : null}
            <Text variant="caption" color="textSecondary">Keep your PIN to yourself. Atlas will never ask for it in a message.</Text>
          </>}
          {problem ? <Text color="danger" accessibilityRole="alert">{problem}</Text> : null}
          <Pressable disabled={busy} onPress={onCancel ?? logout}>
            <Text variant="label" color="textSecondary">{onCancel ? 'Cancel' : 'Sign out'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: colors.bgSurface,
    borderRadius: radii.lg, padding: spacing.xl, gap: spacing.lg },
  brand: { width: 54, height: 54, borderRadius: radii.md, backgroundColor: colors.accentPinkMuted, alignItems: 'center', justifyContent: 'center' },
});
