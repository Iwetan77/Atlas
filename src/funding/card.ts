import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';

import { enginePost } from '@/api/client';
import type { OnrampSession } from '@/api/contract';
import { useAtlasAuth } from '@/auth/context';

// Card top-ups through Circle's Onramp Kit: the engine opens a short-lived session for the user's
// Base wallet (their Atlas balance) and the hosted widget takes the card. The URL is never stored.
export function useCardFunding() {
  const { getAccessToken } = useAtlasAuth();
  const fund = useCallback(async () => {
    const session = await enginePost<OnrampSession>('/v1/onramp/session', await getAccessToken(), { chain: 'base' });
    await WebBrowser.openBrowserAsync(session.widgetUrl);
  }, [getAccessToken]);
  return { fund };
}
