import { engineUrl } from '@/config';

export class EngineUnavailable extends Error {
  constructor(reason: string) {
    super(reason);
  }
}

// Authenticated call to atlas-engine. The engine verifies the Privy access token and works out
// which wallets belong to the caller.
export async function engineGet<T>(path: string, accessToken: string | null): Promise<T> {
  if (!engineUrl) throw new EngineUnavailable('Engine URL is not configured');
  if (!accessToken) throw new EngineUnavailable('Not signed in');
  const res = await fetch(`${engineUrl}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new EngineUnavailable(`Engine returned ${res.status}`);
  return (await res.json()) as T;
}
