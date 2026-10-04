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
  | 'sui'
  // Perps margin held in the user's Hyperliquid account.
  | 'hyperliquid';

export type Venue =
  | 'daya'
  | 'circle'
  | 'jupiter'
  | 'one_inch'
  | 'hyperliquid'
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
  | 'earn_deposit'
  | 'earn_withdraw'
  // Cash leaving Atlas as a coin, for a wallet address outside it.
  | 'withdraw';

// 'fund': money is moving to the venue first (perps margin into Hyperliquid, usually seconds).
// 'sign': a two-step plan's second transaction is ready (GET /v1/intents/{id}/next → { transactions });
// the app signs it without asking again, because the user confirmed the whole action once.
export type IntentStage = 'discover' | 'validate' | 'fund' | 'sign' | 'execute' | 'settle';

// A transaction the user's embedded wallet must sign. The engine builds it; the app never does.
export type TypedData = {
  domain: Record<string, string | number>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
};
export type UnsignedTx =
  | {
      chain: 'base' | 'hyperliquid' | 'polygon';
      typedData: TypedData;
      // Polymarket receives this approved action directly from the user's connection.
      prediction?: { prepareId: string; intentId: string; expiresAtUnixMs: number };
    }

  | {
      // EVM chains the embedded wallet signs on. Base is the default; Ethereum covers L1 legs (e.g.
      // bridging); Monad is where MON is sold from.
      chain: 'base' | 'ethereum' | 'monad' | 'polygon';
      // The exact network: 8453 Base, 1 Ethereum, 143 Monad. Required: the app refuses a plan for a
      // network it doesn't sign on rather than guessing.
      chainId: number;
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
    }
  | {
      // Not a transaction: the exact Privy Wallet API request the engine prepared (signing a swap in
      // the user's own Sui wallet). The device approves it with the user's own authorization key and
      // hands the approval back as a signed entry; the engine passes it to Privy.
      chain: 'privy';
      request: PrivyApprovalRequest;
    };

export type PrivyApprovalRequest = {
  version: 1;
  method: 'POST';
  url: string;
  body: unknown;
  headers: { 'privy-app-id': string; 'privy-request-expiry'?: string };
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
  stage?: 'validate' | 'sign';
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

export type DisplayCurrency = 'NGN' | 'USD' | 'EUR' | 'GBP' | 'ZAR' | 'KES' | 'GHS';

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
  location?: 'wallet' | 'gateway' | 'gateway_pending' | 'perps' | 'earn' | 'predictions';
  // Logo for listed assets (engine catalog); absent for cash.
  iconUrl?: string | null;
};

export type BalanceResponse = {
  // Everything the user owns in spendable form, including `pending`.
  total: Money;
  totalUsd: string;
  // Counted in `total` but still settling (e.g. a Gateway deposit awaiting finality). Null when nothing is.
  pending: Money | null;
  holdings: Holding[];
  // What pays network fees on each chain (SOL on Solana, ETH on Base). Not counted in `total`.
  gas?: GasTank[];
  asOfUnixMs: number;
};

export type GasTank = { chain: Chain; symbol: string; amount: string; value: Money };

// ── Deposits ────────────────────────────────────────────────────────────────────────────
// Naira in by bank transfer: GET /v1/deposit/bank-account → the user's virtual account.
export type BankDepositAccount = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  currency: 'NGN';
};

// Deposits from other networks (USDT on Tron, USDC on Arbitrum…), turned into USDC in the balance
// by 1Click. GET /v1/deposit/networks → { networks: DepositNetwork[] };
// POST /v1/deposit/quote { networkId, amount: Money, receive?: true } → DepositAddress;
// GET /v1/deposit/status?address=&memo= → { state: DepositState, journey }.
export type DepositNetwork = {
  id: string;
  label: string;
  network: string;
  asset: string;
  assetIcon: string | null;
  // The chain's logo, shown as a badge on the coin's (absent for a coin on its own chain, e.g. BTC).
  chainIcon: string | null;
  // In the first list; the rest sit under "See more".
  featured?: boolean;
};
export type DepositAddress = {
  address: string;
  memo: string | null;
  network: string;
  label: string;
  asset: string;
  // Send about this much; anything from minAmount up is converted. Asked with `receive: true`, the
  // amount typed is what lands and sendAmount carries the fees on top.
  sendAmount: string;
  minAmount: string;
  // What the coin sent is worth (older engines leave it out).
  sendValue?: Money;
  receive: Money;
  timeEstimateSec: number | null;
  expiresAtUnixMs: number;
};
export type DepositState = 'waiting' | 'processing' | 'done' | 'incomplete' | 'refunded' | 'failed';

// Withdrawing to a wallet outside Atlas: cash leaves the balance as the coin picked, sent by NEAR
// Intents to the pasted address. The entered amount is the payout; fees are added on top.
// GET /v1/withdrawals/networks → WithdrawNetworks (enabled is false until the fee account is set);
// POST /v1/withdrawals/quote { networkId, address, amount: Money } → WithdrawQuote;
// POST /v1/withdrawals/quote/{quoteId}/execute → ExecutionPlan (kind 'withdraw').
export type WithdrawNetworks = { enabled: boolean; feePercent: string; networks: DepositNetwork[] };
export type WithdrawQuote = {
  quoteId: string;
  networkId: string;
  label: string;
  network: string;
  asset: string;
  address: string;
  // Full cash debit, including the route fee and price buffer. The fee is added to the payout.
  // networkFee estimates the separate wallet transfer cost, paid in its native coin.
  send: Money;
  fee: Money;
  networkFee: Money;
  // Exact quoted coin payout; value is the amount entered in the display currency.
  receive: { amount: string; symbol: string; value: Money };
  timeEstimateSec: number | null;
  expiresAtUnixMs: number;
};
// Each hop a deposit takes, with its transactions as they happen: the deposit on its own network, the
// swap on NEAR Intents, the payout to the user's Solana wallet. `url` opens it in that chain's explorer.
export type DepositHopTx = { hash: string; url: string | null };
export type DepositJourney = { deposit: DepositHopTx[]; swap: DepositHopTx[]; payout: DepositHopTx[] };

// ── Markets and trading ─────────────────────────────────────────────────────────────────
// Spot, memes and tokenized stocks are one kind of thing: an asset with a price. One buy flow.

export type AssetCategory = 'popular' | 'stocks' | 'memes' | 'crypto';

// ── Earn: the balance's cash put to work (Aave savings on Base first) ─────────────────────
// GET /v1/earn/options?currency=NGN → { options: EarnOption[] }. The rate is variable.
export type EarnOption = {
  optionId: string;
  name: string;
  venue: string;
  chain: Chain;
  asset: string;
  apyPct: string;
  about: string;
  // A venue with several markets in one asset (Morpho's vaults) names each: "Gauntlet USDC Prime".
  market?: string | null;
  // Logos: the asset saved in, and the venue.
  iconUrl?: string | null;
  venueIconUrl?: string | null;
};
// GET /v1/earn/positions?currency=NGN → { positions: EarnPosition[] }. Amount includes interest.
export type EarnPosition = {
  optionId: string;
  name: string;
  venue: string;
  amount: string;
  value: Money;
  apyPct: string;
};
// GET /v1/positions/spot?currency=NGN → SpotPositions. Built from Atlas's own filled buys and sells:
// average entry, what went in, live value. Only what the wallet still holds counts, so tokens sent
// away leave with their share of the cost. Money here can be negative (pnl, realizedPnl).
export type SpotPosition = {
  assetId: string;
  symbol: string;
  name: string;
  kind: AssetKind;
  chain: Chain;
  iconUrl: string | null;
  amount: string;
  invested: Money;
  value: Money;
  pnl: Money;
  // Null when nothing is invested (can't take a percentage of zero).
  pnlPct: string | null;
  entryPrice: Money | null;
  price: Money;
  realizedPnl: Money;
  // When this run of holding began; a full sell ends it.
  openedAtUnixMs: number;
};
export type SpotPositions = { positions: SpotPosition[]; asOfUnixMs: number };

// POST /v1/earn/quotes → EarnQuote; POST /v1/earn/quotes/{id}/execute → ExecutionPlan.
export type EarnAction = 'deposit' | 'withdraw';
export type EarnQuote = {
  quoteId: string;
  optionId: string;
  action: EarnAction;
  amount: Money;
  usdc: string;
  // Withdrawing everything, interest included.
  all: boolean;
  apyPct: string;
  expiresAtUnixMs: number;
};

// GET /v1/assets/{assetId}/chart?range=1W&currency=NGN → AssetChart. Display only: points are
// [unix ms, price in the display currency], oldest first, from on-chain trades.
export type ChartRange = '1D' | '1W' | '1M' | '1Y';
export type AssetChart = {
  assetId: string;
  range: ChartRange;
  currency: DisplayCurrency;
  points: [number, number][];
};

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
  // Where the coin lives ('solana', 'base'). Base coins carry Base's badge.
  chain?: string;
  // False for a token found by pasting its address that Jupiter (Solana) or CoinGecko (Base) hasn't
  // verified: anyone can make a token with any name, so the app warns before trading it.
  verified?: boolean;
  // False when Atlas can show the asset but can't buy it yet (e.g. an unlisted Sui token before its
  // route is live): the asset screen shows it without a Buy button.
  tradeable?: boolean;
};

export type AssetsResponse = { assets: MarketAsset[]; searchComplete?: boolean };

export type TradeSide = 'buy' | 'sell';

// POST /v1/quotes. Buy: `amount` is what to spend. Sell: `amount` is the value to sell.
// Both are in the display currency; the engine converts to venue units.
// `all`: a sell of the whole holding (Max); `amount` is then just what it's worth.
export type QuoteRequest = { assetId: string; side: TradeSide; amount: Money; all?: boolean };

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
  // Set when the cash on the asset's chain is short and the rest comes from another chain first
  // (e.g. Base → Solana): how much moves, Layerswap's fee included.
  funding?: { from: string; to: string; amount: Money; fee: Money } | null;
  expiresAtUnixMs: number;
};

// POST /v1/quotes/{quoteId}/execute → ExecutionPlan (fresh venue order for the user's wallet).
// After the one confirmation: POST /v1/intents/{intentId}/signed with what the app signed/sent,
// then GET /v1/intents/{intentId} until it settles.
export type IntentSubmission = { sent: SentTx[]; signed: SignedTx[]; pinAuthorization: string };

export type IntentStatus = {
  intentId: string;
  stage: IntentStage;
  state: 'pending' | 'filled' | 'failed';
  // Final on-chain ids once landed.
  txIds: string[];
  error: string | null;
};

// ── Identity: @handles ──────────────────────────────────────────────────────────────────
// Friends find each other by handle (Privy SMS can't verify Nigerian numbers).
// GET  /v1/me → Me
// POST /v1/me/handle { handle } → Me   (400 invalid: 3–20 of [a-z0-9_]; 409 taken)
// GET  /v1/users/resolve?handle=ade → Recipient   (404 unknown)
export type Me = {
  userId: string;
  handle: string | null;
  displayName: string | null;
  // Profile photo as a small JPEG data URL, set with POST /v1/me/avatar.
  avatar?: string | null;
};
export type Recipient = { handle: string; displayName: string | null };

// ── Send: Atlas Friends, Banks & Mobile Money, Cash Link ────────────────────────────────
export type SendDestination =
  | { type: 'atlas'; handle: string }
  // Nigerian bank account, paid out in naira.
  | { type: 'bank'; bankCode: string; accountNumber: string }
  // An Atlas Link: `escrow` is the address of the link's secret, made on the sender's phone.
  | { type: 'cashlink'; escrow: string; message?: string };

// POST /v1/sends/quote → SendQuote. `amount` is what leaves the balance, in the display currency.
export type SendQuoteRequest = { destination: SendDestination; amount: Money };

export type SendQuote = {
  quoteId: string;
  // Human label for the review screen: "Ade (@ade)", "GTBank · 0123456789 · ADEBAYO JOHN", "Cash link".
  destinationLabel: string;
  send: Money;
  // What the recipient gets (NGN for a bank payout).
  receive: Money;
  fee: Money;
  // "Instant", "Within 5 minutes"…
  eta: string;
  expiresAtUnixMs: number;
};

// POST /v1/sends/quote/{quoteId}/execute → ExecutionPlan, then the same /v1/intents flow as trades.
// A plan may carry zero transactions (the engine moves funds after the user's one confirm). For an
// Atlas Link the phone builds the link itself from the secret it made (src/funding/link-key.ts).

// GET  /v1/offramp/banks?country=NG → { banks: Bank[] }
// POST /v1/offramp/resolve { bankCode, accountNumber } → { accountName }   (404 no such account)
// `logo`: the bank's logo when the engine found one.
export type Bank = { code: string; name: string; logo?: string | null };
// A bank this account number was found at, with the holder's name there.
// POST /v1/offramp/guess { accountNumber } → { banks: BankGuess[] }
export type BankGuess = Bank & { accountName: string };
// GET /v1/offramp/recipients → { recipients }; POST { bankCode, accountNumber, favorite } → same.
export type BankRecipient = {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  favorite: boolean;
  // 0 when saved but never paid.
  lastUsedAtUnixMs: number;
  logo?: string | null;
};

// Adding money by bank transfer: a one-time Nigerian account; its naira lands as USDC.
// POST /v1/onramp/bank/quote { amount: whole naira, currency, receive: true } → BankTransferQuote
//   (nothing opens). With `receive`, `amount` is what lands in the balance and `pay` (what to
//   transfer) carries the fees on top; without it, `amount` is what's transferred.
// POST /v1/onramp/bank       { amount, currency, receive: true }             → BankTransfer
// GET  /v1/onramp/bank/{id}?currency=                          → BankTransfer
export type BankTransferQuote = {
  pay: Money;
  fee: Money;
  // The flat charge for sending the USDC, already taken off `receive`.
  networkFee: string;
  receive: Money;
  rate: string;
};
export type BankTransferState = 'waiting' | 'received' | 'processing' | 'review' | 'completed' | 'failed' | 'expired';
export type BankTransfer = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  // The exact amount to transfer, to the kobo; anything else is sent back.
  pay: Money;
  receive: Money;
  expiresAtUnixMs: number;
  state: BankTransferState;
  message: string | null;
  txId: string | null;
};

// Cash links. The claim secret travels only in the URL fragment (#k=…), which browsers never send
// to a server, so it can't leak into logs.
// GET  /v1/cashlinks/{linkId}            (no auth: the web claim page shows it before sign-in) → CashLink
// POST /v1/cashlinks/{linkId}/claim { secret }  (claimant's Privy token) → IntentStatus
export type CashLink = {
  linkId: string;
  amount: Money;
  sender: { displayName: string | null; handle: string | null };
  message: string | null;
  state: 'open' | 'claimed' | 'expired' | 'cancelled';
  expiresAtUnixMs: number;
};

// ── Perps (Hyperliquid) ─────────────────────────────────────────────────────────────────────
// The app does no perps maths. Every number shown for a position, above all the liquidation
// price, is a field the engine returns from the venue (Hyperliquid); the app never recomputes it.

// GET /v1/perps/markets?currency=NGN → { markets: PerpMarket[] }
export type PerpCategory = 'crypto' | 'meme' | 'stock' | 'commodity' | 'index' | 'currency';

// Every perp the venue lists, most traded first (thin markets can refuse fills).
export type PerpMarket = {
  marketId: string; // e.g. "BTC-PERP", or "xyz:TSLA-PERP" on Hyperliquid's stock dex
  symbol: string;
  name: string; // "Gold", "Alphabet"; the ticker when there's no better name
  category: PerpCategory;
  iconUrl: string | null;
  markPrice: Money;
  change24hPct: string | null;
  maxLeverage: number;
  // Funding per 8h as a percent decimal string ("0.0100"), null if unknown.
  fundingRate8hPct: string | null;
  volume24hUsd: string;
};

// GET /v1/perps/positions?currency=NGN → PerpAccount
export type PerpPosition = {
  positionId: string;
  marketId: string;
  symbol: string;
  iconUrl?: string | null;
  side: 'long' | 'short';
  leverage: number;
  size: string; // base units, e.g. "0.0132"
  entryPrice: Money;
  markPrice: Money;
  // Exactly the venue's value; null when the position has none (low leverage).
  liquidationPrice: Money | null;
  // Null when the venue doesn't report per-position margin; the app never derives it.
  margin: Money | null;
  unrealizedPnl: Money;
  unrealizedPnlPct: string | null;
  // When the position was opened (the share card shows "open · 56m").
  openedAtUnixMs: number;
  // Its take-profit and stop-loss, if set: they close the whole position at market there.
  takeProfit?: PerpTrigger | null;
  stopLoss?: PerpTrigger | null;
};
// A take-profit or stop-loss: its price (USD), and the gain or loss on margin there ("50", "-25").
export type PerpTrigger = { price: Money; pct: string };
export type PerpAccount = { positions: PerpPosition[] };

// POST /v1/perps/quotes { marketId, side, margin: Money, leverage, takeProfitPct?, stopLossPct? }
// → PerpQuote. The percentages are a gain or loss on margin (+50 → +50%), set once it opens.
export type PerpOpenRequest = {
  marketId: string;
  side: 'long' | 'short';
  margin: Money;
  leverage: number;
  takeProfitPct?: number | null;
  stopLossPct?: number | null;
};
// POST /v1/perps/positions/{positionId}/tpsl { takeProfitPct, stopLossPct } (null removes one)
// → PerpTpsl, what's set now.
export type PerpTpsl = { takeProfit: PerpTrigger | null; stopLoss: PerpTrigger | null };
export type PerpQuote = {
  quoteId: string;
  marketId: string;
  side: 'long' | 'short';
  leverage: number;
  margin: Money;
  size: string;
  notional: Money;
  entryPrice: Money;
  // Null before opening when the venue only reports liquidation for open positions (Hyperliquid).
  // The app then says "Available after opening"; it never estimates one.
  liquidationPrice: Money | null;
  fee: Money;
  // Set when the Hyperliquid account is short: this much moves from the Atlas balance to it in the
  // same confirmation (plus Relay's few cents), then the order is placed.
  funding?: { amount: Money } | null;
  // Where the take-profit and stop-loss would sit at this price (when asked for).
  takeProfitPrice?: Money | null;
  stopLossPrice?: Money | null;
  expiresAtUnixMs: number;
};
// POST /v1/perps/quotes/{quoteId}/execute → ExecutionPlan (kind "perp_open"). Carries zero
// transactions unless margin moves in from Solana; the user's Hyperliquid agent places the order.

// POST /v1/perps/positions/{positionId}/close-quote {} → PerpCloseQuote
export type PerpCloseQuote = {
  quoteId: string;
  positionId: string;
  // What comes back to the balance: margin ± realised PnL − fees (the engine moves it back to cash).
  receive: Money;
  realizedPnl: Money;
  exitPrice: Money;
  fee: Money;
  expiresAtUnixMs: number;
};
// POST /v1/perps/close-quotes/{quoteId}/execute → ExecutionPlan (kind "perp_close"),
// then the usual POST /v1/intents/{id}/signed + GET /v1/intents/{id}.

