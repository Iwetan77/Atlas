export type DeviceRequest = {
  id: string;
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  onFailure?: { id: string; statuses: number[] };
};
export type DeviceEnvelope = { expiresAtUnixMs: number; requests: DeviceRequest[] };
export type DeviceResult = { id: string; status: number; body: unknown };

const headerNames = new Set([
  'accept', 'content-type', 'poly_address', 'poly_signature', 'poly_timestamp', 'poly_nonce',
  'poly_api_key', 'poly_passphrase', 'poly_builder_api_key', 'poly_builder_passphrase',
  'poly_builder_timestamp', 'poly_builder_signature',
]);

export function checkDeviceRequest(request: DeviceRequest) {
  const url = new URL(request.url);
  const clob = url.origin === 'https://clob.polymarket.com';
  const relay = url.origin === 'https://relayer-v2.polymarket.com';
  const allowed = clob && (
    request.method === 'GET' && ['/auth/derive-api-key', '/balance-allowance/update'].includes(url.pathname)
    || request.method === 'POST' && ['/auth/api-key', '/order'].includes(url.pathname)
  ) || relay && request.method === 'POST' && url.pathname === '/submit';
  if (!allowed || url.username || url.password || url.hash ||
      Object.keys(request.headers).some((key) => !headerNames.has(key.toLowerCase())) ||
      Object.values(request.headers).some((value) => typeof value !== 'string') ||
      (request.method === 'GET' && request.body !== undefined) ||
      (request.method === 'POST' && typeof request.body !== 'string')) {
    throw new Error('This Predictions request is not supported. Nothing was sent.');
  }
}

// Never retry a mutation. Even a lost reply is reported so the engine can reconcile the original action.
export async function runDeviceRequests(
  envelope: DeviceEnvelope,
  fetchRequest: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<DeviceResult[]> {
  if (!Array.isArray(envelope.requests) || envelope.requests.length > 5 || envelope.requests.length === 0 ||
      !Number.isFinite(envelope.expiresAtUnixMs)) throw new Error('Predictions request unavailable.');
  for (const request of envelope.requests) checkDeviceRequest(request);
  const results: DeviceResult[] = [];
  for (const request of envelope.requests) {
    if (now() >= envelope.expiresAtUnixMs) break;
    const previous = results.at(-1);
    if (request.onFailure) {
      const failed = results.find((r) => r.id === request.onFailure!.id);
      if (!failed || !request.onFailure.statuses.includes(failed.status)) continue;
    } else if (previous && (previous.status < 200 || previous.status >= 300)) break;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetchRequest(request.url, {
        method: request.method, headers: request.headers, body: request.body,
        signal: controller.signal, redirect: 'error', credentials: 'omit',
      });
      const body: unknown = await response.json();
      results.push({ id: request.id, status: response.status, body });
    } catch {
      results.push({ id: request.id, status: 0, body: null });
      break;
    } finally { clearTimeout(timeout); }
  }
  return results;
}
