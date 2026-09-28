// App ↔ atlas-engine contract. Mirrors `engine-types` (Chain, Venue, IntentKind, IntentStage).
// The engine has no HTTP API yet: these shapes are Atlas's proposal and must be agreed with the
// engine before any screen depends on a live endpoint.

export type Chain =
  | 'solana'
  | 'base'
  | 'arc'
  | 'ethereum'
  | 'arbitrum'
  | 'optimism'
  | 'polygon'
  | 'unichain'
  | 'aptos'
  | 'near'
  | 'monad'
  | 'sui';

export type Venue =
  | 'daya'
  | 'circle'
  | 'jupiter'
  | 'one_inch'
  | 'paradex'
  | 'jito'
  | 'marinade'
  | 'aave'
  | 'moonwell'
  | 'near_intents';

export type IntentKind =
  | 'buy'
  | 'sell'
  | 'send'
  | 'off_ramp'
  | 'perp_open'
  | 'perp_close'
  | 'yield_deposit';

export type IntentStage = 'discover' | 'validate' | 'execute' | 'settle';

// A transaction the user's embedded wallet must sign. The engine builds it; the app never does.
export type UnsignedTx =
  | {
      // EVM chains the embedded wallet signs on. Base is the default; Ethereum covers L1 legs (e.g. bridging).
      chain: 'base' | 'ethereum';
      to: `0x${string}`;
      data?: `0x${string}`;
      // Wei, decimal string (JSON has no bigint).
      value?: string;
    }
  | {
      chain: 'solana';
      // Base64 of a serialized VersionedTransaction. May already carry the engine's fee-payer signature.
      transaction: string;
      // 'engine': the app only signs and hands the signed bytes back; the engine lands it
      // (Jupiter's order → execute flow). Engine-submitted transactions come last in a plan.
      submit?: 'app' | 'engine';
    };

export type SignedChain = UnsignedTx['chain'];

export type SentTx = {
  chain: SignedChain;
  // 0x hash on EVM chains, base58 signature on Solana.
  id: string;
};

// A transaction signed by the user for the engine to submit (index = its position in the plan).
export type SignedTx = { index: number; transaction: string };

// What one user action costs to execute. However many transactions it takes, the user
// confirms it exactly once; the app signs `transactions` in order after that single confirm.
export type ExecutionPlan = {
  intentId: string;
  kind: IntentKind;
  // Pre-formatted, display-currency lines for the confirm sheet (engine owns pricing and FX).
  summary: { label: string; value: string }[];
  transactions: UnsignedTx[];
  expiresAtUnixMs: number;
};

// ── Balance ─────────────────────────────────────────────────────────────────────────────
// GET /v1/balance?currency=NGN with `Authorization: Bearer <Privy access token>`.
// The engine resolves the user's wallets from the token; the app never sends addresses.

export type DisplayCurrency = 'NGN' | 'USD' | 'KES' | 'GHS' | 'ZAR';

// Decimal strings throughout so money never passes through floating point on the way in.
export type Money = { amount: string; currency: DisplayCurrency };

export type AssetKind = 'cash' | 'crypto' | 'meme' | 'stock';

export type Holding = {
  assetId: string;
  symbol: string;
  name: string;
  kind: AssetKind;
  // Where the funds actually sit. Shown only in the breakdown, never on the main balance.
  chain: Chain;
  // Token units, e.g. "0.10".
  amount: string;
  value: Money;
  valueUsd: string;
  // Circle Gateway buckets (engine `UsdcBalanceBuckets`). Absent for plain wallet assets.
  location?: 'wallet' | 'gateway' | 'gateway_pending';
};

export type BalanceResponse = {
  // Everything the user owns in spendable form, including `pending`.
  total: Money;
  totalUsd: string;
  // Counted in `total` but still settling (e.g. a Gateway deposit awaiting finality). Null when nothing is.
  pending: Money | null;
  holdings: Holding[];
  asOfUnixMs: number;
};

// ── Deposits ────────────────────────────────────────────────────────────────────────────
// Naira in by bank transfer: GET /v1/deposit/bank-account → the user's Daya virtual account.
export type BankDepositAccount = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  currency: 'NGN';
};

// Card/bank via Circle Onramp: POST /v1/onramp/session → short-lived hosted widget URL.
// The engine picks the destination wallet from the token; the URL must not be cached or logged.
export type OnrampSession = {
  widgetUrl: string;
  expiresAtUnixMs: number;
};

// ── Markets and trading ─────────────────────────────────────────────────────────────────
// Spot, memes and tokenized stocks are one kind of thing: an asset with a price. One buy flow.

export type AssetCategory = 'popular' | 'stocks' | 'memes' | 'crypto';

// GET /v1/assets?currency=NGN&category=popular&q=tesla → { assets: MarketAsset[] }
export type MarketAsset = {
  assetId: string;
  symbol: string;
  name: string;
  kind: AssetKind;
  // Price of one unit, in the display currency, at full precision: memecoins trade far below
  // one naira, so don't round unit prices to 2 decimals ("0.0283", not "0.03").
  price: Money;
  // Percent over 24h as a decimal string ("-3.21"), null when the venue has no history.
  change24hPct: string | null;
  iconUrl: string | null;
};

export type AssetsResponse = { assets: MarketAsset[] };

export type TradeSide = 'buy' | 'sell';

// POST /v1/quotes. Buy: `amount` is what to spend. Sell: `amount` is the value to sell.
// Both are in the display currency; the engine converts to venue units.
export type QuoteRequest = { assetId: string; side: TradeSide; amount: Money };

export type QuoteLeg = { amount: string; symbol: string; value: Money };

export type Quote = {
  quoteId: string;
  assetId: string;
  side: TradeSide;
  pay: QuoteLeg;
  receive: QuoteLeg;
  // One unit of the asset, display currency.
  price: Money;
  fee: Money;
  expiresAtUnixMs: number;
};

// POST /v1/quotes/{quoteId}/execute → ExecutionPlan (fresh venue order for the user's wallet).
// After the one confirmation: POST /v1/intents/{intentId}/signed with what the app signed/sent,
// then GET /v1/intents/{intentId} until it settles.
export type IntentSubmission = { sent: SentTx[]; signed: SignedTx[] };

export type IntentStatus = {
  intentId: string;
  stage: IntentStage;
  state: 'pending' | 'filled' | 'failed';
  // Final on-chain ids once landed.
  txIds: string[];
  error: string | null;
};
