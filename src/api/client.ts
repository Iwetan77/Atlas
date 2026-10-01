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

// The connection failed before an answer came back (a dropped mobile connection, or iOS reusing a
// connection the server had already closed). The request may or may not have reached the engine.
export class EngineUnreachable extends EngineUnavailable {
  constructor() {
    super("Couldn't reach Atlas");
  }
}

// timeoutMs: give up waiting after this long (the call may still complete on the engine).
// retries: how many times to resend after EngineUnreachable. Only for calls the engine can safely
// receive twice; GETs default to 2, POSTs to 0.
type Options = { auth?: boolean; timeoutMs?: number; retries?: number };

// For POSTs the engine answers a second time without acting twice (quotes, plans, confirmations).
export const SAFE_TO_REPLAY: Options = { retries: 2 };

const RETRY_DELAYS_MS = [500, 1500, 3000];

// Privy's identity token rides along with the access token: when Privy signs as the user on the
// engine's side (moves without gas, gas top-ups), its wallet exchange takes this one. The auth
// provider sets where it comes from.
let identityTokenSource: (() => Promise<string | null>) | null = null;
export function setIdentityTokenSource(source: (() => Promise<string | null>) | null) {
  identityTokenSource = source;
}

// Call to atlas-engine. Authenticated calls carry the Privy access token; the engine verifies it
// and works out which wallets belong to the caller.
async function engineRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  accessToken: string | null,
  body?: unknown,
  { auth = true, timeoutMs, retries = method === 'GET' ? 2 : 0 }: Options = {},
): Promise<T> {
  if (!engineUrl) throw new EngineUnavailable('Engine URL is not configured');
  if (auth && !accessToken) throw new EngineUnavailable('Not signed in');
  for (let attempt = 0; ; attempt++) {
    try {
      return await engineAttempt<T>(method, path, accessToken, body, auth, timeoutMs);
    } catch (e) {
      if (!(e instanceof EngineUnreachable) || attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]));
    }
  }
}

async function engineAttempt<T>(
  method: 'GET' | 'POST',
  path: string,
  accessToken: string | null,
  body: unknown,
  auth: boolean,
  timeoutMs: number | undefined,
): Promise<T> {
  const identityToken = auth && identityTokenSource ? await identityTokenSource().catch(() => null) : null;
  const abort = timeoutMs ? new AbortController() : null;
  const timer = abort ? setTimeout(() => abort.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${engineUrl}${path}`, {
      method,
      headers: {
        ...(auth ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(identityToken ? { 'privy-id-token': identityToken } : {}),
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
    if (e instanceof EngineUnavailable) throw e;
    if (abort?.signal.aborted) throw new EngineTimeout();
    console.warn(`[atlas] ${method} ${path} lost its connection`, e);
    throw new EngineUnreachable();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const engineGet = <T>(path: string, accessToken: string | null, options?: Options) =>
  engineRequest<T>('GET', path, accessToken, undefined, options);

export const enginePost = <T>(path: string, accessToken: string | null, body: unknown, options?: Options) =>
  engineRequest<T>('POST', path, accessToken, body, options);
