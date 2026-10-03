import type { ImageSourcePropType } from 'react-native';

// Logos for the assets Atlas lists, bundled so they show instantly and offline. Crypto logos come
// from Trust Wallet's asset repo, tokenized-stock logos from the xStocks issuer. The engine's
// `iconUrl` takes precedence whenever it sends one.
const LOGOS: Record<string, ImageSourcePropType> = {
  AAPL: require('@/assets/logos/aapl.png'),
  BONK: require('@/assets/logos/bonk.png'),
  BNB: require('@/assets/logos/bnb.png'),
  DOGE: require('@/assets/logos/doge.png'),
  BRETT: require('@/assets/logos/brett.png'),
  BTC: require('@/assets/logos/btc.png'),
  ETH: require('@/assets/logos/eth.png'),
  NVDA: require('@/assets/logos/nvda.png'),
  NEAR: require('@/assets/logos/near.png'),
  MON: require('@/assets/chains/monad.png'),
  SOL: require('@/assets/logos/sol.png'),
  TSLA: require('@/assets/logos/tsla.png'),
  SUI: require('@/assets/logos/sui.png'),
  TRX: require('@/assets/logos/trx.png'),
  USDC: require('@/assets/logos/usdc.png'),
  USDT: require('@/assets/logos/usdt.png'),
  XRP: require('@/assets/logos/xrp.png'),
  WIF: require('@/assets/logos/wif.png'),
};

// Wrapped assets share their underlying's logo.
const ALIASES: Record<string, string> = { WETH: 'ETH', WBTC: 'BTC', WNEAR: 'NEAR', WSOL: 'SOL' };

// TSLAx (xStocks) and AAPLc (Coinbase) mark the issuer with a lowercase suffix; the logo is the stock's.
export function bundledLogo(symbol: string): ImageSourcePropType | null {
  const clean = symbol.trim();
  const issuer = clean.match(/^([A-Z]+)[xc]$/)?.[1];
  const base = issuer && LOGOS[issuer] ? issuer : clean.toUpperCase();
  return LOGOS[ALIASES[base] ?? base] ?? null;
}
