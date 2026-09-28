import { createContext, useContext } from 'react';

import type { AtlasAuth } from '@/auth/types';

export const AtlasAuthContext = createContext<AtlasAuth | null>(null);

export function useAtlasAuth(): AtlasAuth {
  const auth = useContext(AtlasAuthContext);
  if (!auth) throw new Error('useAtlasAuth must be used inside <AtlasAuthProvider>');
  return auth;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Something went wrong';
}
