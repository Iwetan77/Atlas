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
      chain: 'base';
      to: `0x${string}`;
      data?: `0x${string}`;
      // Wei, decimal string (JSON has no bigint).
      value?: string;
    }
  | {
      chain: 'solana';
      // Base64 of a serialized VersionedTransaction. May already carry the engine's fee-payer signature.
      transaction: string;
    };

export type SignedChain = UnsignedTx['chain'];

export type SentTx = {
  chain: SignedChain;
  // 0x hash on Base, base58 signature on Solana.
  id: string;
};

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
