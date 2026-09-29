// Web auth on the Privy React SDK. Same Privy app as native, so the same login (e.g. Google)
// resolves to the same Privy user and the same embedded wallet addresses.
import {
  PrivyProvider,
  useCreateWallet,
  useLoginWithEmail,
  useLoginWithOAuth,
  usePrivy,
  useSigners,
} from '@privy-io/react-auth';
import { useCreateWallet as useCreateSolanaWallet } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AtlasAuthContext, errorMessage, withTimeout } from '@/auth/context';
import { useOtpFlow } from '@/auth/otp';
import type { AtlasAuth } from '@/auth/types';
import { privy, solana } from '@/config';
import { privyEvmChains } from '@/signing/chains';
import { colors } from '@/theme';

const solanaRpcs = {
  [solana.chainId]: {
    rpc: createSolanaRpc(solana.rpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(solana.rpcUrl.replace(/^http/, 'ws')),
  },
};

export function AtlasAuthProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={privy.appId}
      config={{
        loginMethods: ['google', 'email'],
        defaultChain: privyEvmChains[0],
        supportedChains: privyEvmChains,
        solana: { rpcs: solanaRpcs },
        appearance: { theme: 'dark', accentColor: colors.accentPink },
        embeddedWallets: {
          // AuthBridge creates both wallets itself, one after the other. Letting Privy also do it
          // on login races ours and one of the two calls fails with "already has a wallet".
          ethereum: { createOnLogin: 'off' },
          solana: { createOnLogin: 'off' },
          // Atlas shows its own single confirmation per action; Privy's per-signature modal stays off.
          showWalletUIs: false,
        },
      }}>
      <AuthBridge>{children}</AuthBridge>
    </PrivyProvider>
  );
}

type WalletAccount = {
  type: string;
  address?: string;
  chainType?: string;
  walletClientType?: string;
};

// Privy marks embedded wallets 'privy' (and 'privy-v2' for newer ones).
const isEmbedded = (a: WalletAccount) => a.walletClientType === 'privy' || a.walletClientType === 'privy-v2';

function embeddedAddress(accounts: WalletAccount[], chainType: 'ethereum' | 'solana') {
  return (
    accounts.find((a) => a.type === 'wallet' && isEmbedded(a) && a.chainType === chainType)?.address ?? null
  );
}

function AuthBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const { createWallet: createEthWallet } = useCreateWallet();
  const { createWallet: createSolWallet } = useCreateSolanaWallet();

  const oauth = useLoginWithOAuth();
  const email = useLoginWithEmail();
  const { addSigners, removeSigners } = useSigners();

  const emailLogin = useOtpFlow(
    useCallback((to) => email.sendCode({ email: to }), [email]),
    useCallback((code) => email.loginWithCode({ code }), [email]),
  );

  const accounts = (user?.linkedAccounts ?? []) as WalletAccount[];
  const baseAddress = embeddedAddress(accounts, 'ethereum');
  const solanaAddress = embeddedAddress(accounts, 'solana');

  // Every signed-in user ends up with both wallets, with no "create wallet" step.
  const creating = useRef(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || !authenticated || !user || creating.current) return;
    if (baseAddress && solanaAddress) return;
    creating.current = true;
    (async () => {
      try {
        if (!baseAddress) await createEthWallet();
        if (!solanaAddress) await createSolWallet();
        setWalletError(null);
      } catch (e) {
        setWalletError(errorMessage(e));
      } finally {
        creating.current = false;
      }
    })();
  }, [ready, authenticated, user, baseAddress, solanaAddress, createEthWallet, createSolWallet]);

  const value = useMemo<AtlasAuth>(
    () => ({
      ready,
      // The React SDK reports init problems through its own console errors, not a hook value.
      initError: null,
      authenticated,
      userId: user?.id ?? null,
      email: user?.google?.email ?? user?.email?.address ?? null,
      wallets: { solana: solanaAddress, base: baseAddress },
      walletsReady: !!solanaAddress && !!baseAddress,
      // A failed attempt doesn't matter once both wallets exist.
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
      loginWithGoogle: () => oauth.initOAuth({ provider: 'google' }),
      googleLoading: oauth.loading,
      googleError: oauth.state.status === 'error' ? errorMessage(oauth.state.error) : null,
      logout,
      getAccessToken,
    }),
    [
      ready,
      authenticated,
      user,
      solanaAddress,
      baseAddress,
      walletError,
      addSigners,
      removeSigners,
      emailLogin,
      oauth,
      logout,
      getAccessToken,
    ],
  );

  return <AtlasAuthContext.Provider value={value}>{children}</AtlasAuthContext.Provider>;
}
