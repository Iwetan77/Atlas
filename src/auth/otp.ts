import { useCallback, useState } from 'react';

import { errorMessage } from '@/auth/context';
import type { OtpFlow, OtpStatus } from '@/auth/types';

// Shared state machine for one-time-code logins. Callers pass the SDK-specific send/verify calls.
export function useOtpFlow(
  send: (target: string) => Promise<unknown>,
  verify: (code: string, target: string) => Promise<unknown>,
): OtpFlow {
  const [status, setStatus] = useState<OtpStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState('');

  const sendCode = useCallback(
    async (to: string) => {
      setError(null);
      setStatus('sending');
      try {
        await send(to);
        setTarget(to);
        setStatus('awaiting-code');
      } catch (e) {
        setError(errorMessage(e));
        setStatus('error');
      }
    },
    [send],
  );

  const submitCode = useCallback(
    async (code: string) => {
      setError(null);
      setStatus('verifying');
      try {
        await verify(code, target);
        setStatus('done');
      } catch (e) {
        setError(errorMessage(e));
        // Wrong code: stay on the code step so the user can retry.
        setStatus('awaiting-code');
      }
    },
    [verify, target],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, sendCode, submitCode, reset };
}
