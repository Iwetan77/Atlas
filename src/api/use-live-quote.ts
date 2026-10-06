import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/auth/context';

// The next price is asked for this long before the current one runs out, so it's normally there by
// then: some venues take a few seconds to quote (a Sui coin's sale, about three).
const EARLY_MS = 5_000;

// A quote that follows its inputs: re-requested shortly after they settle, renewed just before it
// runs out (quietly, the current price still usable meanwhile), fetched afresh on `reload`, and
// never overwritten by a slower, older response. One request at a time: the timer used to ask again
// every second once a price ran out, and each new ask threw the slower one before it away, so a
// venue that takes more than a second never got its answer shown. `request` is null while the inputs
// can't be quoted (e.g. amount is zero).
export function useLiveQuote<Q extends { expiresAtUnixMs: number }>(request: (() => Promise<Q>) | null, active: boolean) {
  const [quote, setQuote] = useState<Q | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const seq = useRef(0);
  // A request is in flight (the timer doesn't start another).
  const busy = useRef(false);
  // The quote already renewed early, so a renewal that failed isn't retried every second.
  const renewed = useRef<Q | null>(null);

  const refresh = useCallback(
    async (quiet = false) => {
      const mine = ++seq.current;
      if (!request) {
        busy.current = false;
        setQuote(null);
        setError(null);
        setQuoting(false);
        return;
      }
      busy.current = true;
      if (!quiet) {
        setQuoting(true);
        setError(null);
      }
      try {
        const q = await request();
        if (mine === seq.current) {
          setQuote(q);
          setError(null);
        }
      } catch (e) {
        // A quiet renewal that fails leaves the current price standing until it runs out.
        if (mine === seq.current && !quiet) {
          setQuote(null);
          setError(errorMessage(e));
        }
      } finally {
        if (mine === seq.current) {
          busy.current = false;
          setQuoting(false);
        }
      }
    },
    [request],
  );

  useEffect(() => {
    if (!active) return;
    const id = setTimeout(refresh, 600);
    return () => clearTimeout(id);
  }, [refresh, active]);

  useEffect(() => {
    if (!quote || !active) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (busy.current) return;
      if (t >= quote.expiresAtUnixMs) void refresh();
      else if (t >= quote.expiresAtUnixMs - EARLY_MS && renewed.current !== quote) {
        renewed.current = quote;
        void refresh(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [quote, active, refresh]);

  const reload = useCallback(() => void refresh(), [refresh]);
  // A price that has run out can't be used, even for the moment before its renewal lands.
  const stale = !!quote && now >= quote.expiresAtUnixMs;
  const secondsLeft = quote ? Math.max(0, Math.ceil((quote.expiresAtUnixMs - now) / 1000)) : 0;
  return { quote, error, quoting: quoting || stale, secondsLeft, reload, clear: () => setQuote(null) };
}
