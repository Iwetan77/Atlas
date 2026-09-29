// Platform-neutral view of the signed-in user. Native (Privy Expo SDK) and web (Privy React SDK)
// each implement this; screens only ever talk to this shape.

export type OtpStatus = 'idle' | 'sending' | 'awaiting-code' | 'verifying' | 'done' | 'error';

export type OtpFlow = {
  status: OtpStatus;
  error: string | null;
  sendCode: (target: string) => Promise<void>;
  submitCode: (code: string) => Promise<void>;
  reset: () => void;
};

export type AtlasWallets = {
  solana: string | null;
  base: string | null;
};

export type AtlasAuth = {
  ready: boolean;
  // The auth SDK failed to initialise (bad client config, blocked network…). Shown on start-up.
  initError: string | null;
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  wallets: AtlasWallets;
  // Both wallets exist and are usable. Screens that sign wait on this.
  walletsReady: boolean;
  // Set when silent wallet creation fails, so it shows up instead of spinning forever.
  walletError: string | null;
  // Privy's own flag that the EVM wallet has delegated/server-side access. A hint only; the engine's
  // onboarding status is the authority on whether its perps signer is authorised.
  evmWalletDelegated: boolean;
  // Adds the engine's server signer to the user's EVM wallet (Privy `addSigners`). No key leaves Privy.
  authorizeServerSigner: (signer: { signerId: string; policyIds: string[] }) => Promise<void>;
  // Removes every signer from the EVM wallet (Privy `removeSigners`).
  revokeServerSigners: () => Promise<void>;
  // Google is the main way in. Email codes are the fallback for people without a Google account.
  // (Privy's SMS only reaches US/Canada, so phone numbers can't be a login here.)
  loginWithGoogle: () => Promise<void>;
  googleLoading: boolean;
  googleError: string | null;
  emailLogin: OtpFlow;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};
