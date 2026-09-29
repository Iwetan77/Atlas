// Native (iOS/Android) auth on the Privy Expo SDK. Web uses provider.web.tsx.
import {
  PrivyProvider,
  getAccessToken,
  useEmbeddedEthereumWallet,
  useEmbeddedSolanaWallet,
  useLoginWithEmail,
  useLoginWithOAuth,
  usePrivy,
  useSigners,
} from '@privy-io/expo';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AtlasAuthContext, errorMessage, withTimeout } from '@/auth/context';
import { useOtpFlow } from '@/auth/otp';
import type { AtlasAuth } from '@/auth/types';
import { privy } from '@/config';
import { privyEvmChains } from '@/signing/chains';

export function AtlasAuthProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={privy.appId}
      clientId={privy.clientId}
      supportedChains={privyEvmChains}
      config={{
        embedded: {
          // AuthBridge creates both wallets itself so the two creators can't race.
          ethereum: { createOnLogin: 'off' },
          solana: { createOnLogin: 'off' },
        },
      }}>
      <AuthBridge>{children}</AuthBridge>
    </PrivyProvider>
  );
}

function AuthBridge({ children }: { children: ReactNode }) {
  const { user, isReady, error: privyError, logout } = usePrivy();
  const eth = useEmbeddedEthereumWallet();
  const sol = useEmbeddedSolanaWallet();

  const oauth = useLoginWithOAuth();
  const email = useLoginWithEmail();
  const { addSigners, removeSigners } = useSigners();

  const emailLogin = useOtpFlow(
    useCallback((to) => email.sendCode({ email: to }), [email]),
    useCallback((code, to) => email.loginWithCode({ code, email: to }), [email]),
  );

  const solanaAddress = sol.status === 'connected' ? (sol.wallets[0]?.address ?? null) : null;
  const baseAddress = eth.wallets[0]?.address ?? null;

  // Every signed-in user ends up with both wallets, with no "create wallet" step.
  const creating = useRef(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  useEffect(() => {
    if (!isReady || !user || creating.current) return;
    const needsEth = eth.wallets.length === 0;
    const needsSol = sol.status === 'not-created';
    if (!needsEth && !needsSol) return;
    creating.current = true;
    (async () => {
      try {
        if (needsEth) await eth.create();
        if (needsSol) await sol.create?.();
        setWalletError(null);
      } catch (e) {
        setWalletError(errorMessage(e));
      } finally {
        creating.current = false;
      }
    })();
  }, [isReady, user, eth, sol]);

  const value = useMemo<AtlasAuth>(() => {
    const accounts = user?.linked_accounts ?? [];
    return {
      ready: isReady,
      initError: privyError ? errorMessage(privyError) : null,
      authenticated: !!user,
      userId: user?.id ?? null,
      email:
        accounts.find((a) => a.type === 'google_oauth')?.email ??
        accounts.find((a) => a.type === 'email')?.address ??
        null,
      wallets: { solana: solanaAddress, base: baseAddress },
      walletsReady: !!solanaAddress && !!baseAddress,
      walletError: solanaAddress && baseAddress ? null : walletError,
      authorizeServerSigner: async (signer) => {
        if (!baseAddress) throw new Error('Your wallet is still being set up');
        await withTimeout(addSigners({ address: baseAddress, signers: [signer] }), 30_000, 'Privy');
      },
      revokeServerSigners: async () => {
        if (!baseAddress) return;
        await withTimeout(removeSigners({ address: baseAddress }), 30_000, 'Privy');
      },
      emailLogin,
      loginWithGoogle: async () => {
        await oauth.login({ provider: 'google' });
      },
      googleLoading: oauth.state.status === 'loading',
      googleError: oauth.state.status === 'error' ? errorMessage(oauth.state.error) : null,
      logout,
      getAccessToken: () => getAccessToken(),
    };
  }, [user, isReady, privyError, solanaAddress, baseAddress, walletError, emailLogin, oauth, logout, addSigners, removeSigners]);

  return <AtlasAuthContext.Provider value={value}>{children}</AtlasAuthContext.Provider>;
}
