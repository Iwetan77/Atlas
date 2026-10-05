// Face ID or Touch ID for the website and the iPhone Home Screen app: a passkey kept on this device
// (WebAuthn with a platform authenticator, user verification required). It only opens the lock
// screen; money still needs the PIN, which the engine checks. The PIN always works too.
import type { IconName } from '@/components/ui/icon';

export type Biometry = { available: boolean; label: string; icon: IconName };

const key = (kind: string, userId: string) => `atlas.${kind}.${userId}`;

function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function label(): { label: string; icon: IconName } {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return { label: 'Face ID', icon: 'scan-outline' };
  if (/Macintosh/.test(ua)) return { label: 'Touch ID', icon: 'finger-print' };
  if (/Android/.test(ua)) return { label: 'fingerprint', icon: 'finger-print' };
  return { label: 'your device unlock', icon: 'finger-print' };
}

export async function biometry(): Promise<Biometry> {
  const named = label();
  try {
    const available = typeof window !== 'undefined'
      && !!window.PublicKeyCredential
      && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return { available, ...named };
  } catch {
    return { available: false, ...named };
  }
}

const encode = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const challenge = () => crypto.getRandomValues(new Uint8Array(32));

export function biometricsOn(userId: string): boolean {
  return !!store()?.getItem(key('biometric', userId));
}

export function biometricsAsked(userId: string): boolean {
  return store()?.getItem(key('biometricAsked', userId)) === '1';
}

export function markBiometricsAsked(userId: string) {
  store()?.setItem(key('biometricAsked', userId), '1');
}

// The browser asks for Face ID / Touch ID once to make this device's passkey.
export async function enableBiometrics(userId: string, _label: string): Promise<boolean> {
  markBiometricsAsked(userId);
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challenge(),
        rp: { name: 'Atlas', id: window.location.hostname },
        user: { id: new TextEncoder().encode(userId).slice(0, 64), name: 'Atlas', displayName: 'Atlas' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        attestation: 'none',
        timeout: 60_000,
      },
    });
    if (!(credential instanceof PublicKeyCredential)) return false;
    store()?.setItem(key('biometric', userId), encode(credential.rawId));
    return true;
  } catch {
    return false;
  }
}

export function disableBiometrics(userId: string) {
  store()?.removeItem(key('biometric', userId));
}

// Opens only if the device checked the person (the "user verified" flag), not just that a key exists.
export async function unlockWithBiometrics(userId: string): Promise<boolean> {
  const id = store()?.getItem(key('biometric', userId));
  if (!id) return false;
  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: challenge(),
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: decode(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    if (!(credential instanceof PublicKeyCredential)) return false;
    const response = credential.response as AuthenticatorAssertionResponse;
    const flags = new Uint8Array(response.authenticatorData)[32] ?? 0;
    return (flags & 0x04) !== 0;
  } catch {
    return false;
  }
}
