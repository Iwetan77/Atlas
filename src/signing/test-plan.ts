// Testnet-only: a real two-chain plan encoded exactly like an engine plan, used to check that one
// confirmation covers every signature. Stands in for the engine until its execute endpoint exists.
import { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { encodeFunctionData, parseAbi, parseEther } from 'viem';

import type { ExecutionPlan } from '@/api/contract';
import { evmChains, solanaConnection } from '@/signing/chains';

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
      { chain: 'base', chainId: evmChains.base.id, to: wallets.base as `0x${string}`, value: '0' },
      { chain: 'solana', transaction: solanaTx },
    ],
    expiresAtUnixMs: Date.now() + 60_000,
  };
}

// Base's official L1StandardBridge on Ethereum Sepolia (docs.base.org → Base contracts). depositETH
// credits the same address on Base Sepolia a few minutes later. Faucets hand out Sepolia ETH far
// more readily than Base Sepolia ETH, so this is how test wallets get Base gas.
const BASE_SEPOLIA_L1_BRIDGE = '0xfd0Bf71F60660E2f608ed56e1659C450eB113120';
const bridgeAbi = parseAbi(['function depositETH(uint32 _minGasLimit, bytes _extraData) payable']);

export function buildBridgeToBasePlan(eth: string): ExecutionPlan {
  return {
    intentId: `bridge-test-${Date.now()}`,
    kind: 'send',
    summary: [
      { label: 'Bridge', value: `${eth} Sepolia ETH` },
      { label: 'To', value: 'Your Base Sepolia wallet' },
      { label: 'Arrives in', value: 'A few minutes' },
    ],
    transactions: [
      {
        chain: 'ethereum',
        chainId: evmChains.ethereum.id,
        to: BASE_SEPOLIA_L1_BRIDGE,
        value: parseEther(eth).toString(),
        data: encodeFunctionData({ abi: bridgeAbi, functionName: 'depositETH', args: [200_000, '0x'] }),
      },
    ],
    expiresAtUnixMs: Date.now() + 60_000,
  };
}
