// Mini apps: dapps on Base and Solana that open inside Atlas with the Atlas wallet connected (an
// EIP-1193 wallet on Base, a Wallet Standard wallet on Solana). Curated so a tap never lands
// somewhere unknown.
export type MiniApp = {
  id: string;
  name: string;
  blurb: string;
  url: string;
  origin: string;
  chain: 'base' | 'solana';
};

export const MINI_APPS: MiniApp[] = [
  { id: 'uniswap', name: 'Uniswap', blurb: 'Swap any token on Base', url: 'https://app.uniswap.org/swap?chain=base', origin: 'app.uniswap.org', chain: 'base' },
  { id: 'aave', name: 'Aave', blurb: 'Lend and borrow', url: 'https://app.aave.com/?marketName=proto_base_v3', origin: 'app.aave.com', chain: 'base' },
  { id: 'aerodrome', name: 'Aerodrome', blurb: "Base's biggest exchange", url: 'https://aerodrome.finance/swap', origin: 'aerodrome.finance', chain: 'base' },
  { id: 'morpho', name: 'Morpho', blurb: 'Vaults that earn', url: 'https://app.morpho.org/base/earn', origin: 'app.morpho.org', chain: 'base' },
  { id: 'moonwell', name: 'Moonwell', blurb: 'Simple lending', url: 'https://moonwell.fi/markets', origin: 'moonwell.fi', chain: 'base' },
  { id: 'zora', name: 'Zora', blurb: 'Collect and create', url: 'https://zora.co', origin: 'zora.co', chain: 'base' },
  // Solana apps checked on 2026-10-01: each loads on a phone-sized screen and lists the Atlas wallet.
  { id: 'jupiter', name: 'Jupiter', blurb: 'Swap anything on Solana', url: 'https://jup.ag', origin: 'jup.ag', chain: 'solana' },
  { id: 'kamino', name: 'Kamino', blurb: 'Lend, borrow and earn', url: 'https://app.kamino.finance', origin: 'app.kamino.finance', chain: 'solana' },
  { id: 'meteora', name: 'Meteora', blurb: 'Pools that earn fees', url: 'https://app.meteora.ag', origin: 'app.meteora.ag', chain: 'solana' },
  { id: 'sanctum', name: 'Sanctum', blurb: 'Stake SOL, stay liquid', url: 'https://app.sanctum.so', origin: 'app.sanctum.so', chain: 'solana' },
  { id: 'drift', name: 'Drift', blurb: 'Trade perps on Solana', url: 'https://app.drift.trade', origin: 'app.drift.trade', chain: 'solana' },
  { id: 'tensor', name: 'Tensor', blurb: 'Buy and sell NFTs', url: 'https://www.tensor.trade', origin: 'www.tensor.trade', chain: 'solana' },
];

export const miniAppIcon = (app: MiniApp) => `https://www.google.com/s2/favicons?domain=${app.origin}&sz=128`;

// The app's own site and its subdomains ("jup.ag" for "station.jup.ag"): where the mini app may go.
// Anything else opens in the phone's browser.
export function onAppSite(app: MiniApp, url: string): boolean {
  if (/^(about:blank|data:|blob:)/i.test(url)) return true;
  const host = /^https?:\/\/([^/:?#]+)/i.exec(url)?.[1]?.toLowerCase();
  if (!host) return false;
  const site = (h: string) => h.split('.').slice(-2).join('.');
  return site(host) === site(app.origin);
}
