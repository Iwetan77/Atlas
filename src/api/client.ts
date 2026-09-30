import { engineUrl } from '@/config';

export class EngineUnavailable extends Error {
  // HTTP status when the engine answered; undefined when it couldn't be reached at all.
  status?: number;

  constructor(reason: string, status?: number) {
    super(reason);
    this.status = status;
  }
}

// The request got no answer in time. The engine may still be working on it.
export class EngineTimeout extends EngineUnavailable {
  constructor() {
    super('Atlas is taking too long to answer');
  }
}

// timeoutMs: give up waiting after this long (the call may still complete on the engine).
type Options = { auth?: boolean; timeoutMs?: number };

// Call to atlas-engine. Authenticated calls carry the Privy access token; the engine verifies it
// and works out which wallets belong to the caller.
async function engineRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  accessToken: string | null,
  body?: unknown,
  { auth = true, timeoutMs }: Options = {},
) {
  if (!engineUrl) throw new EngineUnavailable('Engine URL is not configured');
  if (auth && !accessToken) throw new EngineUnavailable('Not signed in');
  const abort = timeoutMs ? new AbortController() : null;
  const timer = abort ? setTimeout(() => abort.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${engineUrl}${path}`, {
      method,
      headers: {
        ...(auth ? { Authorization: `Bearer ${accessToken}` } : {}),
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: abort?.signal,
    });
    if (!res.ok) {
      // The engine answers errors with a short plain-text (or JSON string) reason; surface it.
      const text = (await res.text().catch(() => '')).replace(/^"|"$/g, '').slice(0, 160);
      throw new EngineUnavailable(text || `Engine returned ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (abort?.signal.aborted) throw new EngineTimeout();
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const engineGet = <T>(path: string, accessToken: string | null, options?: Options) =>
  engineRequest<T>('GET', path, accessToken, undefined, options);

export const enginePost = <T>(path: string, accessToken: string | null, body: unknown, options?: Options) =>
  engineRequest<T>('POST', path, accessToken, body, options);
