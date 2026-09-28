// Platform-neutral view of the signed-in user. Native (Privy Expo SDK) and web (Privy React SDK)
// each implement this; screens only ever talk to this shape.

export type OtpStatus = 'idle' | 'sending' | 'awaiting-code' | 'verifying' | 'done' | 'error';

export type OtpFlow = {
  status: OtpStatus;
  error: string | null;
  sendCode: (phone: string) => Promise<void>;
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
  phone: string | null;
  email: string | null;
  wallets: AtlasWallets;
  // Both wallets exist and are usable. Screens that sign wait on this.
  walletsReady: boolean;
  phoneLogin: OtpFlow;
  // Adds a phone number to an account that signed in another way (the "Connect phone number" step).
  phoneLink: OtpFlow;
  loginWithGoogle: () => Promise<void>;
  googleLoading: boolean;
  googleError: string | null;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};
