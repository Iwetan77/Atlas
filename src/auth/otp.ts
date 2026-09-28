import { useCallback, useState } from 'react';

import { errorMessage } from '@/auth/context';
import type { OtpFlow, OtpStatus } from '@/auth/types';

// Shared state machine for the SMS code flows. Callers pass the SDK-specific send/verify calls.
export function useOtpFlow(
  send: (phone: string) => Promise<unknown>,
  verify: (code: string, phone: string) => Promise<unknown>,
): OtpFlow {
  const [status, setStatus] = useState<OtpStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');

  const sendCode = useCallback(
    async (to: string) => {
      setError(null);
      setStatus('sending');
      try {
        await send(to);
        setPhone(to);
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
        await verify(code, phone);
        setStatus('done');
      } catch (e) {
        setError(errorMessage(e));
        // Wrong code: stay on the code step so the user can retry.
        setStatus('awaiting-code');
      }
    },
    [verify, phone],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, sendCode, submitCode, reset };
}
