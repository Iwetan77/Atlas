// Face ID, Touch ID or a fingerprint to open Atlas on a phone. Turned on per person, per device; the
// PIN always works too. The web version (biometrics.web.ts) uses the browser's passkey prompt.
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import { readDeviceValue, writeDeviceValue } from '@/auth/device-session';
import type { IconName } from '@/components/ui/icon';

export type Biometry = { available: boolean; label: string; icon: IconName };

const NONE: Biometry = { available: false, label: 'biometrics', icon: 'finger-print' };

// Secure store keys allow letters, digits, ".", "-" and "_" only.
const key = (kind: string, userId: string) => `atlas.${kind}.${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`;

export async function biometry(): Promise<Biometry> {
  try {
    const [hardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const label = Platform.OS === 'ios'
      ? face ? 'Face ID' : 'Touch ID'
      : finger ? 'fingerprint' : face ? 'face unlock' : 'biometrics';
    return { available: hardware && enrolled, label, icon: face && !finger ? 'scan-outline' : 'finger-print' };
  } catch {
    return NONE;
  }
}

export function biometricsOn(userId: string): boolean {
  return readDeviceValue(key('biometric', userId)) === '1';
}

// Whether they've already answered "open Atlas with Face ID?" on this device.
export function biometricsAsked(userId: string): boolean {
  return readDeviceValue(key('biometricAsked', userId)) === '1';
}

export function markBiometricsAsked(userId: string) {
  writeDeviceValue(key('biometricAsked', userId), '1');
}

async function prompt(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use PIN',
      // The Atlas PIN is the fallback, not the phone's passcode.
      disableDeviceFallback: true,
      fallbackLabel: '',
    });
    return result.success;
  } catch {
    return false;
  }
}

// Asks once to prove it works, then remembers the choice on this device.
export async function enableBiometrics(userId: string, label: string): Promise<boolean> {
  const ok = await prompt(`Turn on ${label} for Atlas`);
  if (ok) writeDeviceValue(key('biometric', userId), '1');
  markBiometricsAsked(userId);
  return ok;
}

export function disableBiometrics(userId: string) {
  writeDeviceValue(key('biometric', userId), null);
}

export async function unlockWithBiometrics(userId: string): Promise<boolean> {
  if (!biometricsOn(userId)) return false;
  return prompt('Open Atlas');
}
