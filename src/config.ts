// Public, client-side config only. Server secrets (Privy app secret, Circle keys) live in the engine.

export type Network = 'testnet' | 'mainnet';

export const network: Network = process.env.EXPO_PUBLIC_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

export const privy = {
  appId: 'cmul70rwg04dv0cjy2hgogv50',
  // Native app client from the Privy dashboard (App settings → Clients). Web doesn't use it.
  clientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '',
} as const;

export const solana = {
  rpcUrl:
    process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
    (network === 'mainnet' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com'),
  // Wallet Standard chain id, used by Privy's web SDK.
  chainId: network === 'mainnet' ? 'solana:mainnet' : 'solana:devnet',
} as const;

export const engineUrl = process.env.EXPO_PUBLIC_ENGINE_URL ?? '';

// Dev tools (wallet addresses, signing test) only on testnet builds.
export const showDevTools = network === 'testnet';
