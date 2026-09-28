// Web auth on the Privy React SDK. Same Privy app as native, so the same login (e.g. Google)
// resolves to the same Privy user and the same embedded wallet addresses.
import {
  PrivyProvider,
  useCreateWallet,
  useLinkPhone,
  useLoginWithOAuth,
  useLoginWithSms,
  usePrivy,
} from '@privy-io/react-auth';
import { useCreateWallet as useCreateSolanaWallet } from '@privy-io/react-auth/solana';
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { base, baseSepolia } from 'viem/chains';

import { AtlasAuthContext, errorMessage } from '@/auth/context';
import { useOtpFlow } from '@/auth/otp';
import type { AtlasAuth } from '@/auth/types';
import { network, privy } from '@/config';
import { colors } from '@/theme';

export function AtlasAuthProvider({ children }: { children: ReactNode }) {
  const chain = network === 'mainnet' ? base : baseSepolia;
  return (
    <PrivyProvider
      appId={privy.appId}
      config={{
        loginMethods: ['sms', 'google'],
        defaultChain: chain,
        supportedChains: [chain],
        appearance: { theme: 'dark', accentColor: colors.accentPink },
        embeddedWallets: {
          ethereum: { createOnLogin: 'all-users' },
          solana: { createOnLogin: 'all-users' },
          // Atlas shows its own single confirmation per action; Privy's per-signature modal stays off.
          showWalletUIs: false,
        },
      }}>
      <AuthBridge>{children}</AuthBridge>
    </PrivyProvider>
  );
}

type WalletAccount = { type: string; address?: string; chainType?: string; walletClientType?: string };

function embeddedAddress(accounts: WalletAccount[], chainType: 'ethereum' | 'solana') {
  return (
    accounts.find(
      (a) => a.type === 'wallet' && a.walletClientType === 'privy' && a.chainType === chainType,
    )?.address ?? null
  );
}

function AuthBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const { createWallet: createEthWallet } = useCreateWallet();
  const { createWallet: createSolWallet } = useCreateSolanaWallet();

  const sms = useLoginWithSms();
  const link = useLinkPhone();
  const oauth = useLoginWithOAuth();

  const phoneLogin = useOtpFlow(
    useCallback((phone) => sms.sendCode({ phoneNumber: phone }), [sms]),
    useCallback((code) => sms.loginWithCode({ code }), [sms]),
  );
  const phoneLink = useOtpFlow(
    useCallback((phone) => link.sendCode({ phoneNumber: phone }), [link]),
    useCallback((code) => link.linkWithCode({ code }), [link]),
  );

  const accounts = (user?.linkedAccounts ?? []) as WalletAccount[];
  const baseAddress = embeddedAddress(accounts, 'ethereum');
  const solanaAddress = embeddedAddress(accounts, 'solana');

  // Same safety net as native: every signed-in user ends up with both wallets.
  const creating = useRef(false);
  useEffect(() => {
    if (!ready || !authenticated || !user || creating.current) return;
    if (baseAddress && solanaAddress) return;
    creating.current = true;
    (async () => {
      try {
        if (!baseAddress) await createEthWallet();
        if (!solanaAddress) await createSolWallet();
      } finally {
        creating.current = false;
      }
    })();
  }, [ready, authenticated, user, baseAddress, solanaAddress, createEthWallet, createSolWallet]);

  const value = useMemo<AtlasAuth>(
    () => ({
      ready,
      authenticated,
      userId: user?.id ?? null,
      phone: user?.phone?.number ?? null,
      email: user?.google?.email ?? user?.email?.address ?? null,
      wallets: { solana: solanaAddress, base: baseAddress },
      walletsReady: !!solanaAddress && !!baseAddress,
      phoneLogin,
      phoneLink,
      loginWithGoogle: () => oauth.initOAuth({ provider: 'google' }),
      googleLoading: oauth.loading,
      googleError: oauth.state.status === 'error' ? errorMessage(oauth.state.error) : null,
      logout,
      getAccessToken,
    }),
    [ready, authenticated, user, solanaAddress, baseAddress, phoneLogin, phoneLink, oauth, logout, getAccessToken],
  );

  return <AtlasAuthContext.Provider value={value}>{children}</AtlasAuthContext.Provider>;
}
