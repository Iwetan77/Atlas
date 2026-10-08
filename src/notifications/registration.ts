
import { enginePost } from '@/api/client';
import { readDeviceValue, writeDeviceValue } from '@/auth/device-session';

const KEY = 'atlas.notifications.device';
export type Registration = { owner: string; id: string };
export function rememberedDevice(): Registration | null {
  try { return JSON.parse(readDeviceValue(KEY) ?? 'null'); } catch { return null; }
}
export function rememberDevice(device: Registration | null) { writeDeviceValue(KEY, device ? JSON.stringify(device) : null); }
export async function registerDevice(owner: string, kind: 'web' | 'expo', subscription: unknown, token: string | null) {
  const device = await enginePost<{ id: string }>('/v1/notifications/register', token, { kind, subscription }, { retries: 2, timeoutMs: 15_000 });
  rememberDevice({ owner, id: device.id });
}
export async function removeDevice(getToken: () => Promise<string | null>) {
  const saved = rememberedDevice();
  if (!saved) return;
  await enginePost('/v1/notifications/unregister', await getToken(), { id: saved.id }, { retries: 2, timeoutMs: 8_000 });
  rememberDevice(null);
}
