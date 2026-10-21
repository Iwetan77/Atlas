import { useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/auth/context';

// Waits before trying again when creating a new user's wallets fails. Right after sign-up Privy's
// wallet service can refuse for a moment, and one failed try used to leave the account with no
// wallet until the app was restarted: every screen said the wallet "is not ready".
const RETRY_MS = [2_000, 5_000, 10_000, 15_000];

// Every signed-in user ends up with both wallets, with no "create wallet" step. Returns the last
// failure while a wallet is still missing.
export function useEnsureWallets(
  owner: string | null,
  needsEth: boolean,
  needsSol: boolean,
  createEth: () => Promise<unknown>,
  createSol: () => Promise<unknown>,
): string | null {
  const creating = useRef(false);
  const nextTry = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  // Another account starts over.
  const [failuresFor, setFailuresFor] = useState(owner);
  if (failuresFor !== owner) {
    setFailuresFor(owner);
    setFailures(0);
    setError(null);
  }

  useEffect(() => {
    if (!owner || creating.current || (!needsEth && !needsSol) || Date.now() < nextTry.current) return;
    creating.current = true;
    (async () => {
      try {
        if (needsEth) await createEth();
        if (needsSol) await createSol();
        setError(null);
      } catch (e) {
        setError(errorMessage(e));
        nextTry.current = Date.now() + RETRY_MS[Math.min(failures, RETRY_MS.length - 1)];
        // The next try runs when the wait is over (a redraw before then doesn't start one).
        setTimeout(() => setFailures((n) => n + 1), nextTry.current - Date.now());
      } finally {
        creating.current = false;
      }
    })();
  }, [owner, needsEth, needsSol, createEth, createSol, failures]);

  return needsEth || needsSol ? error : null;
}
