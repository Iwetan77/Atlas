import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { OtpFlow } from '@/auth/types';
import { Field } from '@/components/ui/field';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

// Nigeria first; the rest match the display currencies Atlas plans to support.
const COUNTRIES = [
  { code: '+234', label: 'NG' },
  { code: '+254', label: 'KE' },
  { code: '+233', label: 'GH' },
  { code: '+27', label: 'ZA' },
  { code: '+1', label: 'US' },
] as const;

type Props = {
  flow: OtpFlow;
  submitLabel: string;
};

export function PhoneOtpForm({ flow, submitLabel }: Props) {
  const [dial, setDial] = useState<string>(COUNTRIES[0].code);
  const [local, setLocal] = useState('');
  const [code, setCode] = useState('');

  // Drop the trunk "0" people type locally (0803… → +234 803…).
  const digits = local.replace(/\D/g, '').replace(/^0+/, '');
  const e164 = `${dial}${digits}`;
  const codeStep = flow.status === 'awaiting-code' || flow.status === 'verifying';

  if (codeStep) {
    return (
      <View style={styles.form}>
        <Text color="textSecondary">
          Enter the 6-digit code sent to <Text variant="bodyStrong">{e164}</Text>
        </Text>
        <Field
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxLength={6}
        />
        {flow.error ? <Text color="danger">{flow.error}</Text> : null}
        <PillButton
          label={submitLabel}
          disabled={code.length !== 6}
          loading={flow.status === 'verifying'}
          onPress={() => flow.submitCode(code)}
        />
        <View style={styles.row}>
          <Pressable onPress={() => flow.sendCode(e164)} hitSlop={8}>
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
              Change number
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <View style={styles.chips}>
        {COUNTRIES.map((c) => {
          const active = c.code === dial;
          return (
            <Pressable
              key={c.code}
              onPress={() => setDial(c.code)}
              style={[
                styles.chip,
                {
                  borderColor: active ? colors.accentPink : colors.border,
                  backgroundColor: active ? colors.accentPinkDim : colors.bgBase,
                },
              ]}>
              <Text variant="label" color={active ? 'accentPinkTint' : 'textSecondary'}>
                {c.label} {c.code}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Field
        prefix={dial}
        value={local}
        onChangeText={setLocal}
        placeholder="803 123 4567"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoFocus
      />
      {flow.error ? <Text color="danger">{flow.error}</Text> : null}
      <PillButton
        label="Send code"
        disabled={digits.length < 7}
        loading={flow.status === 'sending'}
        onPress={() => flow.sendCode(e164)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
});
