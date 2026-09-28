import { Connection } from '@solana/web3.js';
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';

import type { SentTx } from '@/api/contract';
import { network, solana } from '@/config';

export const baseChain = network === 'mainnet' ? base : baseSepolia;

export const basePublicClient = createPublicClient({ chain: baseChain, transport: http() });

export const solanaConnection = new Connection(solana.rpcUrl, 'confirmed');

// Plans run in order (e.g. approve → swap), so each transaction must land before the next is sent.
export async function waitForTx(sent: SentTx): Promise<void> {
  if (sent.chain === 'base') {
    const receipt = await basePublicClient.waitForTransactionReceipt({ hash: sent.id as `0x${string}` });
    if (receipt.status !== 'success') throw new Error(`Base transaction reverted: ${sent.id}`);
    return;
  }
  const latest = await solanaConnection.getLatestBlockhash();
  const { value } = await solanaConnection.confirmTransaction(
    { signature: sent.id, ...latest },
    'confirmed',
  );
  if (value.err) throw new Error(`Solana transaction failed: ${sent.id}`);
}
