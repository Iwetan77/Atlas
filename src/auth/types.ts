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
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  wallets: AtlasWallets;
  // Both wallets exist and are usable. Screens that sign wait on this.
  walletsReady: boolean;
  // Google is the main way in. Email codes are the fallback for people without a Google account.
  // (Privy's SMS only reaches US/Canada, so phone numbers can't be a login here.)
  loginWithGoogle: () => Promise<void>;
  googleLoading: boolean;
  googleError: string | null;
  emailLogin: OtpFlow;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};
