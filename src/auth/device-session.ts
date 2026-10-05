// What this device remembers between runs, read synchronously before the first screen draws: whether
// someone was signed in (a restart then shows the Atlas logo and the lock, never the welcome screen),
// and whether that signed-out state was asked for.
import { Platform } from 'react-native';

const SIGNED_IN = 'atlas.signedIn';

function read(key: string): string | null {
  try {
    if (Platform.OS === 'web') return typeof window === 'undefined' ? null : window.localStorage?.getItem(key) ?? null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo-secure-store') as typeof import('expo-secure-store')).getItem(key);
  } catch {
    return null;
  }
}

export function writeDeviceValue(key: string, value: string | null) {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      if (value === null) window.localStorage?.removeItem(key);
      else window.localStorage?.setItem(key, value);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const store = require('expo-secure-store') as typeof import('expo-secure-store');
    if (value === null) void store.deleteItemAsync(key);
    else store.setItem(key, value);
  } catch {
    // Not remembered: the next start just behaves like a first one.
  }
}

export const readDeviceValue = read;

// A login the browser already holds (Privy keeps its tokens in local storage, or marks a cookie
// session), so even the first start after an update opens to the logo, not the welcome screen.
function browserSession(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    const kept = ['privy:refresh_token', 'privy:token', 'privy:pat', 'privy:id_token']
      .some((key) => { const v = window.localStorage?.getItem(key); return !!v && v !== 'null' && v !== '""'; });
    return kept || /(^|;\s*)privy-session=/.test(document.cookie);
  } catch {
    return false;
  }
}

// Read once per run: the state the app started in, until someone signs out.
const startedSignedIn = read(SIGNED_IN) === '1' || browserSession();
let signedOut = false;
let signingOut = false;

export function startedWithSession(): boolean {
  return startedSignedIn && !signedOut;
}

export function rememberSignedIn(on: boolean) {
  writeDeviceValue(SIGNED_IN, on ? '1' : null);
}

// Sign out was tapped: show the welcome screen at once instead of waiting out a session blip.
export function markSigningOut() {
  signingOut = true;
  signedOut = true;
  rememberSignedIn(false);
}

export function takeSigningOut(): boolean {
  const was = signingOut;
  signingOut = false;
  return was;
}

// The welcome screen was on screen during this run: whoever signs in now has just proved who they
// are, so Atlas doesn't ask for the PIN to open on top of that.
let welcome = false;

export function markWelcomeShown() {
  welcome = true;
}

export function welcomeShown(): boolean {
  return welcome;
}
