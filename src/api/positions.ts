import { useCallback, useEffect, useState } from 'react';

import { engineGet } from '@/api/client';
import type { SpotPosition, SpotPositions } from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { useSettings } from '@/settings/context';

export type SpotPositionsState = {
  data: SpotPosition[] | null;
  error: string | null;
  reload: () => Promise<void>;
};

// Entry, what went in and live gain or loss for each spot holding bought through Atlas.
export function useSpotPositions(): SpotPositionsState {
  const { authenticated, getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const [data, setData] = useState<SpotPosition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!authenticated) return Promise.resolve();
    return getAccessToken()
      .then((token) => engineGet<SpotPositions>(`/v1/positions/spot?currency=${displayCurrency}`, token))
      .then(
        (next) => {
          setData(next.positions);
          setError(null);
        },
        // Keep the last good cards; the holdings list still shows everything without them.
        (e) => setError(errorMessage(e)),
      );
  }, [authenticated, getAccessToken, displayCurrency]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, reload };
}
