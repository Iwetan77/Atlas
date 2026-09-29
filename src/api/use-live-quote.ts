import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/auth/context';

// A quote that follows its inputs: re-requested shortly after they settle, refreshed when it
// expires, and never overwritten by a slower, older response. `request` is null while the inputs
// can't be quoted (e.g. amount is zero).
export function useLiveQuote<Q extends { expiresAtUnixMs: number }>(request: (() => Promise<Q>) | null, active: boolean) {
  const [quote, setQuote] = useState<Q | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    if (!request) {
      setQuote(null);
      setError(null);
      setQuoting(false);
      return;
    }
    setQuoting(true);
    setError(null);
    try {
      const q = await request();
      if (mine === seq.current) setQuote(q);
    } catch (e) {
      if (mine === seq.current) {
        setQuote(null);
        setError(errorMessage(e));
      }
    } finally {
      if (mine === seq.current) setQuoting(false);
    }
  }, [request]);

  useEffect(() => {
    if (!active) return;
    const id = setTimeout(refresh, 600);
    return () => clearTimeout(id);
  }, [refresh, active]);

  useEffect(() => {
    if (!quote || !active) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() > quote.expiresAtUnixMs) refresh();
    }, 1000);
    return () => clearInterval(id);
  }, [quote, active, refresh]);

  const secondsLeft = quote ? Math.max(0, Math.ceil((quote.expiresAtUnixMs - now) / 1000)) : 0;
  return { quote, error, quoting, secondsLeft, clear: () => setQuote(null) };
}
