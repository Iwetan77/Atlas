import { useCallback, useEffect, useState } from 'react';

import { engineGet, enginePost } from '@/api/client';
import { errorMessage, useAtlasAuth } from '@/auth/context';

// GET /v1/me/emails → where Atlas emails the user about their money, and whether it does.
// `available` is false while the engine has no email service set up.
export type EmailSettings = { available: boolean; email: string | null; enabled: boolean };

// Profile's "Email me about my money": loads with the screen, flips at once, and goes back if the
// engine says no.
export function useEmailSettings() {
  const { authenticated, getAccessToken } = useAtlasAuth();
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!authenticated) return Promise.resolve();
    return getAccessToken()
      .then((token) => engineGet<EmailSettings>('/v1/me/emails', token))
      .then(
        (next) => {
          setSettings(next);
          setError(null);
        },
        (e) => setError(errorMessage(e)),
      );
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    const timer = setTimeout(reload, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const setEnabled = async (enabled: boolean) => {
    const before = settings;
    if (before) setSettings({ ...before, enabled });
    setError(null);
    try {
      setSettings(await enginePost<EmailSettings>('/v1/me/emails', await getAccessToken(), { enabled }));
    } catch (e) {
      setSettings(before);
      setError(errorMessage(e));
    }
  };

  return { settings, error, setEnabled };
}
