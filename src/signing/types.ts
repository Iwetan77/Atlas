import type { SentTx, UnsignedTx } from '@/api/contract';

// Sends one engine-built transaction from the user's embedded wallet with no wallet UI.
// The single user-facing confirmation happens before this, in the confirm sheet.
export type Signer = {
  ready: boolean;
  // `intentId` names the plan the transaction belongs to (the iPhone relays Base transactions by it).
  send: (tx: UnsignedTx, intentId: string) => Promise<SentTx>;
  // Sign without broadcasting, for transactions the engine lands (submit: 'engine'). Base64 out.
  sign: (tx: UnsignedTx) => Promise<string>;
};
