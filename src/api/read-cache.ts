// A short, bounded cache for read-only display data. Keys must include the owner and
// every request parameter; quotes, plans and money-moving requests never use it.
export function createReadCache<T>(ttlMs: number, limit: number, cacheable: (value: T) => boolean = () => true) {
  const values = new Map<string, { at: number; value: T }>();
  const pending = new Map<string, Promise<T>>();
  const peek = (key: string): T | null => {
    const entry = values.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at >= ttlMs) { values.delete(key); return null; }
    return entry.value;
  };
  const read = (key: string, fetcher: () => Promise<T>, refresh = false): Promise<T> => {
    if (!refresh) {
      const cached = peek(key);
      if (cached !== null) return Promise.resolve(cached);
    }
    const running = pending.get(key);
    if (running) return running;
    const request = Promise.resolve().then(fetcher).then(value => {
      if (cacheable(value)) {
        values.delete(key);
        values.set(key, { at: Date.now(), value });
        while (values.size > limit) values.delete(values.keys().next().value!);
      }
      return value;
    }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
    pending.set(key, request);
    return request;
  };
  return { peek, read };
}
