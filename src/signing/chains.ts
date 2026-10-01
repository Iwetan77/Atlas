import { Connection } from '@solana/web3.js';
import { type Chain, createPublicClient, http, type PublicClient } from 'viem';
import { base, mainnet, monad } from 'viem/chains';

import type { SentTx, UnsignedTx } from '@/api/contract';
import { solana } from '@/config';

// Mainnet only: Base, Ethereum for the occasional L1 leg, and Monad (selling MON sends it from here).
export const evmChains = {
  base,
  ethereum: mainnet,
  monad,
} as const;

// Every EVM network the app will sign on, and which `chain` family each belongs to. A plan names
// its network by chainId; anything else is refused rather than guessed.
const KNOWN_EVM: Record<number, { chain: Chain; family: 'base' | 'ethereum' | 'monad' }> = {
  [base.id]: { chain: base, family: 'base' },
  [mainnet.id]: { chain: mainnet, family: 'ethereum' },
  [monad.id]: { chain: monad, family: 'monad' },
};

// Privy must know every chain it may send on; the build's default Base goes first.
export const privyEvmChains = [
  evmChains.base,
  ...Object.values(KNOWN_EVM)
    .map((k) => k.chain)
    .filter((c) => c.id !== evmChains.base.id),
] as [Chain, ...Chain[]];

type EvmTx = Extract<UnsignedTx, { chain: 'base' | 'ethereum' | 'monad' }>;

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
  monad: evmClient(evmChains.monad),
};

export const solanaConnection = new Connection(solana.rpcUrl, 'confirmed');

// Plans run in order (e.g. approve → swap), so each transaction must land before the next is sent.
export async function waitForTx(sent: SentTx, tx: UnsignedTx): Promise<void> {
  if (tx.chain === 'privy') return;
  if (tx.chain !== 'solana') {
    const receipt = await evmClient(evmChainFor(tx)).waitForTransactionReceipt({ hash: sent.id as `0x${string}` });
    if (receipt.status !== 'success') throw new Error(`Transaction reverted on ${sent.chain}: ${sent.id}`);
    return;
  }
  const latest = await solanaConnection.getLatestBlockhash();
  const { value } = await solanaConnection.confirmTransaction({ signature: sent.id, ...latest }, 'confirmed');
  if (value.err) throw new Error(`Solana transaction failed: ${sent.id}`);
}

// Right after one transaction lands, the node behind the wallet can still be a block behind and
// refuse the next one in its pre-send check (Uniswap's "STF": the approval it relies on isn't there
// yet). Nothing is broadcast when that happens, so it waits and tries again for a few seconds.
const CATCH_UP_TRIES = 5;
const CATCH_UP_MS = 2_000;

export async function sendAfterPrevious(send: () => Promise<SentTx>, tx: UnsignedTx): Promise<SentTx> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const behind = /revert|nonce too low|STF/i.test(message);
      if (tx.chain === 'solana' || !behind || attempt >= CATCH_UP_TRIES) throw e;
      await new Promise((r) => setTimeout(r, CATCH_UP_MS));
    }
  }
}

// A wallet can broadcast a transaction even when the call reporting it fails (a dropped mobile
// connection). So a failed EVM send is only called "not sent" once the wallet's transaction count
// shows nothing went out; otherwise the user is told to check before trying again.
export class MaybeSent extends Error {
  constructor() {
    super('This may have gone through. Check your balance before trying again.');
  }
}

const SETTLE_CHECK_MS = 4_000;

export async function sendOnce(
  send: () => Promise<SentTx>,
  tx: UnsignedTx,
  from: string | null,
  afterPrevious: boolean,
): Promise<SentTx> {
  const attempt = () => (afterPrevious ? sendAfterPrevious(send, tx) : send());
  if (tx.chain === 'solana' || tx.chain === 'privy' || !from) return attempt();
  const client = evmClient(evmChainFor(tx));
  const address = from as `0x${string}`;
  const count = () => client.getTransactionCount({ address, blockTag: 'pending' }).catch(() => null);
  const before = await count();
  try {
    return await attempt();
  } catch (e) {
    if (before === null) throw e;
    await new Promise((r) => setTimeout(r, SETTLE_CHECK_MS));
    const after = await count();
    if (after !== null && after > before) throw new MaybeSent();
    throw e;
  }
}
