import { Platform } from 'react-native';
import { readDeviceValue, writeDeviceValue } from '@/auth/device-session';

const PENDING = 'atlas.pendingClaim.v1';
type Pending = { id: string; secret: string; path: string; at: number };
let memory: Pending | null = null;
function read(): Pending | null {
  if (memory) return memory;
  try {
    const raw = Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? window.sessionStorage.getItem(PENDING) : null)
      : readDeviceValue(PENDING);
    const saved = raw ? JSON.parse(raw) as Pending : null;
    if (saved && /^[A-Za-z0-9_-]+$/.test(saved.id) && /^0x[0-9a-f]{64}$/.test(saved.secret)
      && /^\/(claim|invite)\/[A-Za-z0-9_-]+$/.test(saved.path) && saved.path.split('/').pop() === saved.id
      && Number.isFinite(saved.at) && saved.at <= Date.now() && Date.now() - saved.at < 30 * 86400_000) memory = saved;
  } catch { /* The in-memory continuation still works with blocked storage. */ }
  return memory;
}
export function rememberPendingClaim(id: string, secret: string, path = `/claim/${id}`): void {
  if (!/^[A-Za-z0-9_-]+$/.test(id) || !/^0x[0-9a-f]{64}$/.test(secret)
    || !/^\/(claim|invite)\/[A-Za-z0-9_-]+$/.test(path) || path.split('/').pop() !== id) return;
  memory = { id, secret, path, at: Date.now() };
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.sessionStorage.setItem(PENDING, JSON.stringify(memory));
    } else writeDeviceValue(PENDING, JSON.stringify(memory));
  } catch { /* Private browsing: keep the claim through provider remounts in memory. */ }
}
export function pendingClaimPath(): string | null { return read()?.path ?? null; }
export function pendingClaimSecret(id: string): string { const value = read(); return value?.id === id ? value.secret : ''; }
export function clearPendingClaim(id?: string): void {
  if (id && read()?.id !== id) return;
  memory = null;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.sessionStorage.removeItem(PENDING);
    } else writeDeviceValue(PENDING, null);
  } catch { /* Nothing else to clear. */ }
}
