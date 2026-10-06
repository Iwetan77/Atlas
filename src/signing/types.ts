import type { PrivyApprovalRequest, SentTx, UnsignedTx } from '@/api/contract';

// Sends one engine-built transaction from the user's embedded wallet with no wallet UI.
// The single user-facing confirmation happens before this, in the confirm sheet.
export type Signer = {
  ready: boolean;
  // While not ready, what it's waiting for, in words for the confirmation ("Connecting your wallet…").
  waiting?: string | null;
  send: (tx: UnsignedTx) => Promise<SentTx>;
  // Sign without broadcasting, for transactions the engine lands (submit: 'engine'). Base64 out.
  sign: (tx: UnsignedTx) => Promise<string>;
  // Approve an exact Privy request with the user's own authorization key (chain: 'privy').
  approve: (request: PrivyApprovalRequest) => Promise<string>;
};
