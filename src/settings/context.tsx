import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { DisplayCurrency } from '@/api/contract';

export type Settings = {
  displayCurrency: DisplayCurrency;
  // Blur/hide balance figures on screen.
  stealthMode: boolean;
  // Show zero-balance assets in the Home breakdown.
  showEmptyPockets: boolean;
  // Promo banners the user closed.
  dismissedPromos: string[];
};

const DEFAULTS: Settings = {
  displayCurrency: 'NGN',
  stealthMode: false,
  showEmptyPockets: false,
  dismissedPromos: [],
};

const KEY = 'atlas:settings:v1';

type SettingsContextValue = Settings & {
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

// Device-local display preferences. Nothing here affects funds, so it doesn't go to the engine.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSettings({ ...DEFAULTS, ...JSON.parse(raw) }))
      .catch(() => {});
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ...settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}
