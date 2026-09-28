import { engineUrl } from '@/config';

export class EngineUnavailable extends Error {
  constructor(reason: string) {
    super(reason);
  }
}

// Authenticated call to atlas-engine. The engine verifies the Privy access token and works out
// which wallets belong to the caller.
async function engineRequest<T>(method: 'GET' | 'POST', path: string, accessToken: string | null, body?: unknown) {
  if (!engineUrl) throw new EngineUnavailable('Engine URL is not configured');
  if (!accessToken) throw new EngineUnavailable('Not signed in');
  const res = await fetch(`${engineUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new EngineUnavailable(`Engine returned ${res.status}`);
  return (await res.json()) as T;
}

export const engineGet = <T>(path: string, accessToken: string | null) =>
  engineRequest<T>('GET', path, accessToken);

export const enginePost = <T>(path: string, accessToken: string | null, body: unknown) =>
  engineRequest<T>('POST', path, accessToken, body);
