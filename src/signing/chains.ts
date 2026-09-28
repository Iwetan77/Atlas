import { Connection } from '@solana/web3.js';
import { createPublicClient, http } from 'viem';
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains';

import type { SentTx } from '@/api/contract';
import { network, solana } from '@/config';

export const evmChains = {
  base: network === 'mainnet' ? base : baseSepolia,
  ethereum: network === 'mainnet' ? mainnet : sepolia,
} as const;

export const evmClients = {
  base: createPublicClient({ chain: evmChains.base, transport: http() }),
  ethereum: createPublicClient({ chain: evmChains.ethereum, transport: http() }),
};

export const solanaConnection = new Connection(solana.rpcUrl, 'confirmed');

// Plans run in order (e.g. approve → swap), so each transaction must land before the next is sent.
export async function waitForTx(sent: SentTx): Promise<void> {
  if (sent.chain !== 'solana') {
    const receipt = await evmClients[sent.chain].waitForTransactionReceipt({ hash: sent.id as `0x${string}` });
    if (receipt.status !== 'success') throw new Error(`Transaction reverted on ${sent.chain}: ${sent.id}`);
    return;
  }
  const latest = await solanaConnection.getLatestBlockhash();
  const { value } = await solanaConnection.confirmTransaction(
    { signature: sent.id, ...latest },
    'confirmed',
  );
  if (value.err) throw new Error(`Solana transaction failed: ${sent.id}`);
}
