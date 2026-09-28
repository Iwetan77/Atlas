import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { OtpFlow } from '@/auth/types';
import { Field } from '@/components/ui/field';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';

export function EmailOtpForm({ flow }: { flow: OtpFlow }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  const address = email.trim().toLowerCase();
  const looksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

  if (flow.status === 'awaiting-code' || flow.status === 'verifying') {
    return (
      <View style={styles.form}>
        <Text color="textSecondary">
          Enter the 6-digit code sent to <Text variant="bodyStrong">{address}</Text>
        </Text>
        <Field
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
        />
        {flow.error ? <Text color="danger">{flow.error}</Text> : null}
        <PillButton
          label="Continue"
          disabled={code.length !== 6}
          loading={flow.status === 'verifying'}
          onPress={() => flow.submitCode(code)}
        />
        <View style={styles.links}>
          <Pressable onPress={() => flow.sendCode(address)} hitSlop={8}>
            <Text variant="label" color="accentPinkTint">
              Resend code
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setCode('');
              flow.reset();
            }}
            hitSlop={8}>
            <Text variant="label" color="textSecondary">
              Use a different email
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Field
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
      {flow.error ? <Text color="danger">{flow.error}</Text> : null}
      <PillButton
        label="Send code"
        disabled={!looksValid}
        loading={flow.status === 'sending'}
        onPress={() => flow.sendCode(address)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
