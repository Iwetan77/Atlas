import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
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
  const desktop = useWindowDimensions().width >= 760;
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
  const steps = change || !initialHandle ? 3 : 2;
  const step = !handle || stage === 'current' ? 1 : stage === 'repeat' ? steps : steps - 1;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.wrap}>
          <View style={styles.header}>
            <View style={styles.wordmark}>
              <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
              <Text variant="title" style={styles.atlas}>atlas<Text variant="title" color="accentPink">.</Text></Text>
            </View>
            <View style={styles.security}><Icon name="lock-closed-outline" size={13} color="textSecondary" />
              <Text variant="caption" color="textSecondary">Secure setup</Text></View>
          </View>
          <View style={[styles.card, desktop && styles.desktopCard]}>
            <View style={styles.intro}>
              <View style={styles.brand}><Icon name={stage === 'repeat' ? 'checkmark-done-outline' : 'shield-checkmark-outline'} size={30} color="accentPinkTint" /></View>
              <View style={styles.step}>
                <Text variant="overline" color="accentPinkTint">{!handle ? 'YOUR ACCOUNT' : 'PAYMENT PIN'}</Text>
                <Text variant="caption" color="textSecondary">{'Step ' + step + ' of ' + steps}</Text>
              </View>
              <View style={styles.progress}>
                {Array.from({ length: steps }, (_, i) => <View key={i} style={[styles.progressLine, i < step && styles.progressDone]} />)}
              </View>
              <Text variant="title" style={styles.title}>{!handle ? 'Choose your @handle' : stage === 'current' ? 'Your current PIN' : stage === 'repeat' ? 'Enter it once more' : change ? 'Choose a new PIN' : 'Protect your money'}</Text>
              <Text color="textSecondary" style={styles.description}>{!handle
                ? 'Your own name for sending and receiving money on Atlas.'
                : stage === 'repeat' ? 'Enter the same four digits to finish setting up.'
                : stage === 'current' ? 'Enter your current PIN before choosing a new one.'
                : 'Choose four digits. You’ll use them to approve payments and trades.'}</Text>
            </View>
            {!handle ? <View style={styles.handle}>
              <Field prefix="@" placeholder="yourname" value={rawHandle} onChangeText={setRawHandle}
                autoCapitalize="none" autoCorrect={false} maxLength={21} accessibilityLabel="Your handle" />
              <Text variant="caption" color="textSecondary">3–20 letters, numbers or underscores. Your handle is permanent.</Text>
              <PillButton label="Continue" loading={busy} disabled={!HANDLE_RE.test(name)} onPress={saveHandle} />
            </View> : <>
              <PinPad label={stage === 'repeat' ? 'Repeat payment PIN' : stage === 'current' ? 'Current payment PIN' : 'New payment PIN'}
                resetKey={reset} disabled={busy} onComplete={enter} />
              {busy ? <ActivityIndicator color={colors.accentPink} /> : null}
              {stage === 'repeat' && !busy ? <Pressable style={styles.link} onPress={() => { setFirst(''); setStage('new'); setReset((n) => n+1); }}>
                <Text variant="label" color="accentPinkTint">Choose a different PIN</Text>
              </Pressable> : null}
            </>}
            {problem ? <Text color="danger" style={styles.error} accessibilityRole="alert">{problem}</Text> : null}
            <View style={styles.footer}>
              {handle ? <View style={styles.privacy}>
                <Icon name="lock-closed-outline" size={14} color="textDisabled" />
                <Text variant="caption" color="textSecondary" style={styles.privacyText}>Your PIN stays private. Atlas will never ask for it in a message.</Text>
              </View> : null}
              <Pressable disabled={busy} style={styles.link} onPress={onCancel ?? logout}>
                <Text variant="label" color="textSecondary">{onCancel ? 'Cancel' : 'Sign out'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  wrap: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 32, height: 32, borderRadius: radii.sm },
  atlas: { fontSize: 25, lineHeight: 32 },
  security: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  card: { width: '100%', gap: 20 },
  desktopCard: { backgroundColor: colors.bgSurface, borderRadius: radii.lg, padding: spacing.xxl,
    borderWidth: 1, borderColor: colors.border },
  intro: { alignItems: 'center', gap: spacing.sm },
  brand: { width: 56, height: 56, borderRadius: 20, backgroundColor: colors.accentPinkMuted,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  progress: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  progressLine: { width: 28, height: 3, borderRadius: radii.pill, backgroundColor: colors.border },
  progressDone: { backgroundColor: colors.accentPink },
  title: { textAlign: 'center', fontSize: 28, lineHeight: 34 },
  description: { textAlign: 'center', maxWidth: 310 },
  handle: { gap: spacing.lg },
  link: { alignSelf: 'center', minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center' },
  footer: { gap: spacing.xs, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.md },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: spacing.sm },
  privacyText: { maxWidth: 284, flexShrink: 1 },
  error: { textAlign: 'center' },
});
