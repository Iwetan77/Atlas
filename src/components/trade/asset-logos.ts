import type { ImageSourcePropType } from 'react-native';

// Logos for the assets Atlas lists, bundled so they show instantly and offline. Crypto logos come
// from Trust Wallet's asset repo, tokenized-stock logos from the xStocks issuer. The engine's
// `iconUrl` takes precedence whenever it sends one.
const LOGOS: Record<string, ImageSourcePropType> = {
  AAPL: require('@/assets/logos/aapl.png'),
  BONK: require('@/assets/logos/bonk.png'),
  BRETT: require('@/assets/logos/brett.png'),
  BTC: require('@/assets/logos/btc.png'),
  ETH: require('@/assets/logos/eth.png'),
  NVDA: require('@/assets/logos/nvda.png'),
  SOL: require('@/assets/logos/sol.png'),
  TSLA: require('@/assets/logos/tsla.png'),
  USDC: require('@/assets/logos/usdc.png'),
  WIF: require('@/assets/logos/wif.png'),
};

// Wrapped assets share their underlying's logo.
const ALIASES: Record<string, string> = { WETH: 'ETH', WBTC: 'BTC' };

// TSLAx (xStocks) and AAPLc (Coinbase) mark the issuer with a lowercase suffix; the logo is the stock's.
export function bundledLogo(symbol: string): ImageSourcePropType | null {
  const base = symbol.replace(/[a-z]$/, '').toUpperCase();
  return LOGOS[ALIASES[base] ?? base] ?? null;
}
