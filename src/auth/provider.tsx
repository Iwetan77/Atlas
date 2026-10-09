import { disconnectNotifications } from '@/notifications/device';
// Native (iOS/Android) auth on the Privy Expo SDK. Web uses provider.web.tsx.
import {
  PrivyProvider,
  getAccessToken,
  useEmbeddedEthereumWallet,
  useEmbeddedSolanaWallet,
  useLoginWithEmail,
  useLoginWithOAuth,
  usePrivy,
} from '@privy-io/expo';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AtlasAuthContext, errorMessage } from '@/auth/context';
import { markSigningOut } from '@/auth/device-session';
import { createWalletReconnect, hasEmbeddedWallet } from '@/auth/wallet-reconnect';
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

  const emailLogin = useOtpFlow(
    useCallback((to) => email.sendCode({ email: to }), [email]),
    useCallback((code, to) => email.loginWithCode({ code, email: to }), [email]),
  );

  // Keep the known address while the wallet's transport reconnects, matching the native signer.
  const solUsable = sol.status === 'connected' || sol.status === 'connecting' || sol.status === 'reconnecting';
  const solanaAddress = solUsable ? (sol.wallets?.[0]?.address ?? null) : null;
  const baseAddress = eth.wallets[0]?.address ?? null;
  const linkedAccounts = user?.linked_accounts ?? [];
  const hasSolanaWallet = !!sol.wallets?.length || hasEmbeddedWallet(linkedAccounts, 'solana');
  const hasEthereumWallet = !!eth.wallets.length || hasEmbeddedWallet(linkedAccounts, 'ethereum');

  // One owner for connection/recovery, rather than one attempt from every signer hook. Privy's
  // first load can fail while Android restores the session; retry its transport without a restart.
  const reconnect = useMemo(() => createWalletReconnect(), []);
  useEffect(() => {
    reconnect.update({
      ready: isReady, userId: user?.id ?? null, status: sol.status,
      hasWallet: hasSolanaWallet, connect: sol.getProvider, recover: sol.recover,
    });
  }, [reconnect, isReady, user?.id, sol, hasSolanaWallet]);
  useEffect(() => () => reconnect.cancel(), [reconnect]);

  // Every signed-in user ends up with both wallets, with no "create wallet" step.
  const creating = useRef(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  useEffect(() => {
    if (!isReady || !user || creating.current) return;
    const needsEth = !hasEthereumWallet;
    const needsSol = sol.status === 'not-created' && !hasSolanaWallet;
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
  }, [isReady, user, eth, sol, hasEthereumWallet, hasSolanaWallet]);

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
      emailLogin,
      loginWithGoogle: async () => {
        await oauth.login({ provider: 'google' });
      },
      googleLoading: oauth.state.status === 'loading',
      googleError: oauth.state.status === 'error' ? errorMessage(oauth.state.error) : null,
      logout: async () => {
        await disconnectNotifications(getAccessToken);
        markSigningOut();
        await logout();
      },
      getAccessToken: () => getAccessToken(),
    };
  }, [user, isReady, privyError, solanaAddress, baseAddress, walletError, emailLogin, oauth, logout]);

  return <AtlasAuthContext.Provider value={value}>{children}</AtlasAuthContext.Provider>;
}
