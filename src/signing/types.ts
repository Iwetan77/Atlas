import type { SentTx, UnsignedTx } from '@/api/contract';

// Sends one engine-built transaction from the user's embedded wallet with no wallet UI.
// The single user-facing confirmation happens before this, in the confirm sheet.
export type Signer = {
  ready: boolean;
  send: (tx: UnsignedTx) => Promise<SentTx>;
};
