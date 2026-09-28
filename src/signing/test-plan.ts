// Testnet-only: a real two-chain plan encoded exactly like an engine plan, used to check that one
// confirmation covers every signature. Stands in for the engine until its execute endpoint exists.
import { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

import type { ExecutionPlan } from '@/api/contract';
import { solanaConnection } from '@/signing/chains';

const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export async function buildSigningTestPlan(wallets: { base: string; solana: string }): Promise<ExecutionPlan> {
  const payer = new PublicKey(wallets.solana);
  const { blockhash } = await solanaConnection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [
      new TransactionInstruction({
        programId: MEMO_PROGRAM,
        keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
        data: Buffer.from('atlas one-confirmation test'),
      }),
    ],
  }).compileToV0Message();
  const solanaTx = Buffer.from(new VersionedTransaction(message).serialize()).toString('base64');

  return {
    intentId: `signing-test-${Date.now()}`,
    kind: 'send',
    summary: [
      { label: 'Test', value: 'One confirm, two chains' },
      { label: 'Base Sepolia', value: '0 ETH to yourself' },
      { label: 'Solana devnet', value: 'Memo, no transfer' },
    ],
    transactions: [
      { chain: 'base', to: wallets.base as `0x${string}`, value: '0' },
      { chain: 'solana', transaction: solanaTx },
    ],
    expiresAtUnixMs: Date.now() + 60_000,
  };
}
