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

// Privy calls that fail by throwing outside their promise would otherwise leave a spinner forever.
export function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${what} didn't respond. Please try again.`)), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}
