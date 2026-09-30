import { Connection } from '@solana/web3.js';
import { type Chain, createPublicClient, http, type PublicClient } from 'viem';
import { base, mainnet } from 'viem/chains';

import type { SentTx, UnsignedTx } from '@/api/contract';
import { solana } from '@/config';

// Mainnet only: Base, and Ethereum for the occasional L1 leg.
export const evmChains = {
  base,
  ethereum: mainnet,
} as const;

// Every EVM network the app will sign on, and which `chain` family each belongs to. A plan names
// its network by chainId; anything else is refused rather than guessed.
const KNOWN_EVM: Record<number, { chain: Chain; family: 'base' | 'ethereum' }> = {
  [base.id]: { chain: base, family: 'base' },
  [mainnet.id]: { chain: mainnet, family: 'ethereum' },
};

// Privy must know every chain it may send on; the build's default Base goes first.
export const privyEvmChains = [
  evmChains.base,
  ...Object.values(KNOWN_EVM)
    .map((k) => k.chain)
    .filter((c) => c.id !== evmChains.base.id),
] as [Chain, ...Chain[]];

type EvmTx = Extract<UnsignedTx, { chain: 'base' | 'ethereum' }>;

export function evmChainFor(tx: EvmTx): Chain {
  const known = KNOWN_EVM[tx.chainId];
  if (!known || known.family !== tx.chain) {
    throw new Error(`This plan targets a network Atlas doesn't sign on (${tx.chain}, chain ${tx.chainId ?? 'unspecified'})`);
  }
  return known.chain;
}

const clients = new Map<number, PublicClient>();
export function evmClient(chain: Chain): PublicClient {
  let c = clients.get(chain.id);
  if (!c) {
    c = createPublicClient({ chain, transport: http() }) as PublicClient;
    clients.set(chain.id, c);
  }
  return c;
}

export const evmClients = {
  base: evmClient(evmChains.base),
  ethereum: evmClient(evmChains.ethereum),
};

export const solanaConnection = new Connection(solana.rpcUrl, 'confirmed');

// Plans run in order (e.g. approve → swap), so each transaction must land before the next is sent.
export async function waitForTx(sent: SentTx, tx: UnsignedTx): Promise<void> {
  if (tx.chain !== 'solana') {
    const receipt = await evmClient(evmChainFor(tx)).waitForTransactionReceipt({ hash: sent.id as `0x${string}` });
    if (receipt.status !== 'success') throw new Error(`Transaction reverted on ${sent.chain}: ${sent.id}`);
    return;
  }
  const latest = await solanaConnection.getLatestBlockhash();
  const { value } = await solanaConnection.confirmTransaction({ signature: sent.id, ...latest }, 'confirmed');
  if (value.err) throw new Error(`Solana transaction failed: ${sent.id}`);
}
