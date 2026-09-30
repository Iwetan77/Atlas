// Mini apps: dapps on Base that open inside Atlas with the Atlas wallet connected. Curated so a
// tap never lands somewhere unknown.
export type MiniApp = {
  id: string;
  name: string;
  blurb: string;
  url: string;
  origin: string;
};

export const MINI_APPS: MiniApp[] = [
  { id: 'uniswap', name: 'Uniswap', blurb: 'Swap any token on Base', url: 'https://app.uniswap.org/swap?chain=base', origin: 'app.uniswap.org' },
  { id: 'aave', name: 'Aave', blurb: 'Lend and borrow', url: 'https://app.aave.com/?marketName=proto_base_v3', origin: 'app.aave.com' },
  { id: 'aerodrome', name: 'Aerodrome', blurb: "Base's biggest exchange", url: 'https://aerodrome.finance/swap', origin: 'aerodrome.finance' },
  { id: 'morpho', name: 'Morpho', blurb: 'Vaults that earn', url: 'https://app.morpho.org/base/earn', origin: 'app.morpho.org' },
  { id: 'moonwell', name: 'Moonwell', blurb: 'Simple lending', url: 'https://moonwell.fi/markets', origin: 'moonwell.fi' },
  { id: 'zora', name: 'Zora', blurb: 'Collect and create', url: 'https://zora.co', origin: 'zora.co' },
];

export const miniAppIcon = (app: MiniApp) => `https://www.google.com/s2/favicons?domain=${app.origin}&sz=128`;
