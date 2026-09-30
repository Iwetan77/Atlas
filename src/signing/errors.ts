import { EngineUnreachable } from '@/api/client';
import { errorMessage } from '@/auth/context';

// Wallet/RPC errors arrive as raw viem or Solana dumps (URLs, hex, versions). Users get one plain line;
// the full error still goes to the console for debugging.
export function friendlyTxError(e: unknown): string {
  const raw = errorMessage(e);
  console.warn('[atlas] transaction failed', e);

  // Only reaches here before the user confirms (after that, a lost connection means keep watching the
  // status), so nothing has been ordered or sent.
  if (e instanceof EngineUnreachable) return "Couldn't reach Atlas. Check your connection and try again.";

  if (/insufficient (funds|lamports|.*balance)|attempt to debit an account but found no record/i.test(raw)) {
    return "You don't have enough for this.";
  }
  if (/user rejected|denied|cancel/i.test(raw)) return 'Cancelled.';
  if (/blockhash not found|expired|timed? ?out/i.test(raw)) return 'That took too long. Please try again.';
  if (/reverted/i.test(raw)) return "The transaction didn't go through. Nothing was taken from your balance.";

  const firstLine = raw.split('\n')[0].trim();
  return firstLine.length > 140 ? `${firstLine.slice(0, 137)}…` : firstLine;
}
