// Public, client-side config only. Server secrets (Privy app secret, Circle keys) live in the engine.

export const privy = {
  appId: 'cmul70rwg04dv0cjy2hgogv50',
  // Native app client (dashboard: App settings → Clients). Public, like the app ID. Web doesn't use it.
  clientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || 'client-WY6dyrwek4P4TtG1H167Jxd3UFnGGgH9iucUoTCBuhAVN',
} as const;

// Atlas runs on mainnet only.
export const solana = {
  rpcUrl: process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
  // Wallet Standard chain id, used by Privy's web SDK.
  chainId: 'solana:mainnet',
} as const;

export const engineUrl = process.env.EXPO_PUBLIC_ENGINE_URL ?? '';
// The hosted web app, where Atlas Links open. Links can't be made until it's set.
export const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? '';
