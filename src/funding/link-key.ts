import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import { sha256, stringToHex } from 'viem';
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts';

import { webUrl } from '@/config';

// An Atlas Link's secret: made on this phone and carried only in the link. Its address is the link's
// escrow (and its id); the engine sees the secret only when someone claims. It's kept on this phone
// too, so the sender can take the money back if nobody claims it.
export type LinkKey = { secret: `0x${string}`; escrow: string };

export function newLinkKey(): LinkKey {
  const secret = generatePrivateKey();
  return { secret, escrow: privateKeyToAddress(secret).toLowerCase() };
}

export async function keepLinkKey(key: LinkKey): Promise<void> {
  const name = `atlas-link-${key.escrow}`;
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(name, key.secret);
    } catch {
      // Private browsing: the link itself still holds the secret.
    }
    return;
  }
  await SecureStore.setItemAsync(name, key.secret);
}

// The public alias is short; the private key stays in the fragment, never in server logs.
// Nine hash bytes give a stable 12-character alias; the engine enforces uniqueness.
// The React Native/browser Buffer implementation supports base64, not Node’s base64url.
function base64Url(bytes: Buffer): string {
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function linkCode(escrow: string): string {
  return base64Url(Buffer.from(sha256(stringToHex(escrow.toLowerCase())).slice(2, 20), 'hex'));
}
export function encodeLinkSecret(secret: string): string {
  return base64Url(Buffer.from(secret.replace(/^0x/, ''), 'hex'));
}
export function decodeLinkSecret(raw: string): string {
  if (/^0x[0-9a-fA-F]{64}$/.test(raw)) return raw.toLowerCase();
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return '';
  const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/') + '=', 'base64');
  return decoded.length === 32 ? `0x${decoded.toString('hex')}` : '';
}
export function claimUrl(key: LinkKey): string | null {
  return webUrl ? `${webUrl.replace(/\/$/, '')}/invite/${linkCode(key.escrow)}#k=${encodeLinkSecret(key.secret)}` : null;
}
export function publicLinkLabel(url: string): string {
  return url.split('#')[0].replace(/^https?:\/\//, '');
}
