// Native (iOS/Android) auth on the Privy Expo SDK. Web uses provider.web.tsx.
import {
  PrivyProvider,
  getAccessToken,
  useEmbeddedEthereumWallet,
  useEmbeddedSolanaWallet,
  useLinkSMS,
  useLoginWithOAuth,
  useLoginWithSMS,
  usePrivy,
} from '@privy-io/expo';
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { base, baseSepolia } from 'viem/chains';

import { AtlasAuthContext, errorMessage } from '@/auth/context';
import { useOtpFlow } from '@/auth/otp';
import type { AtlasAuth } from '@/auth/types';
import { network, privy } from '@/config';

export function AtlasAuthProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={privy.appId}
      clientId={privy.clientId}
      supportedChains={network === 'mainnet' ? [base] : [baseSepolia]}
      config={{
        embedded: {
          ethereum: { createOnLogin: 'all-users' },
          solana: { createOnLogin: 'all-users' },
        },
      }}>
      <AuthBridge>{children}</AuthBridge>
    </PrivyProvider>
  );
}

function AuthBridge({ children }: { children: ReactNode }) {
  const { user, isReady, logout } = usePrivy();
  const eth = useEmbeddedEthereumWallet();
  const sol = useEmbeddedSolanaWallet();

  const smsLogin = useLoginWithSMS();
  const smsLink = useLinkSMS();
  const oauth = useLoginWithOAuth();

  const phoneLogin = useOtpFlow(
    useCallback((phone) => smsLogin.sendCode({ phone }), [smsLogin]),
    useCallback((code, phone) => smsLogin.loginWithCode({ code, phone }), [smsLogin]),
  );
  const phoneLink = useOtpFlow(
    useCallback((phone) => smsLink.sendCode({ phone }), [smsLink]),
    useCallback((code, phone) => smsLink.linkWithCode({ code, phone }), [smsLink]),
  );

  const solanaAddress = sol.status === 'connected' ? (sol.wallets[0]?.address ?? null) : null;
  const baseAddress = eth.wallets[0]?.address ?? null;

  // createOnLogin covers new users. This covers accounts that predate it, so every signed-in
  // user ends up with both wallets without a separate "create wallet" step.
  const creating = useRef(false);
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
      } finally {
        creating.current = false;
      }
    })();
  }, [isReady, user, eth, sol]);

  const value = useMemo<AtlasAuth>(() => {
    const accounts = user?.linked_accounts ?? [];
    const phone = accounts.find((a) => a.type === 'phone');
    const email =
      accounts.find((a) => a.type === 'google_oauth')?.email ??
      accounts.find((a) => a.type === 'email')?.address ??
      null;
    return {
      ready: isReady,
      authenticated: !!user,
      userId: user?.id ?? null,
      phone: phone && 'number' in phone ? (phone.number ?? null) : null,
      email,
      wallets: { solana: solanaAddress, base: baseAddress },
      walletsReady: !!solanaAddress && !!baseAddress,
      phoneLogin,
      phoneLink,
      loginWithGoogle: async () => {
        await oauth.login({ provider: 'google' });
      },
      googleLoading: oauth.state.status === 'loading',
      googleError: oauth.state.status === 'error' ? errorMessage(oauth.state.error) : null,
      logout,
      getAccessToken: () => getAccessToken(),
    };
  }, [user, isReady, solanaAddress, baseAddress, phoneLogin, phoneLink, oauth, logout]);

  return <AtlasAuthContext.Provider value={value}>{children}</AtlasAuthContext.Provider>;
}
