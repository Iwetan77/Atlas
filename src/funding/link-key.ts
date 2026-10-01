import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
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

// Where links open: the hosted web app. Empty until it's live, and links wait for it.
export function claimUrl(key: LinkKey): string | null {
  return webUrl ? `${webUrl.replace(/\/$/, '')}/claim/${key.escrow}#k=${key.secret}` : null;
}
