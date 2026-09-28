// Native signer: Privy Expo SDK embedded wallets. The Expo SDK has no signing UI of its own,
// so nothing here can prompt the user.
import { useEmbeddedEthereumWallet, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { useCallback } from 'react';
import { numberToHex } from 'viem';

import type { SentTx, UnsignedTx } from '@/api/contract';
import { evmChains, solanaConnection } from '@/signing/chains';
import type { Signer } from '@/signing/types';

export function useSigner(): Signer {
  const eth = useEmbeddedEthereumWallet();
  const sol = useEmbeddedSolanaWallet();

  const ethWallet = eth.wallets[0];
  const solWallet = sol.status === 'connected' ? sol.wallets[0] : undefined;

  const send = useCallback(
    async (tx: UnsignedTx): Promise<SentTx> => {
      if (tx.chain !== 'solana') {
        if (!ethWallet) throw new Error('EVM wallet is not ready');
        const provider = await ethWallet.getProvider();
        const hash = await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: ethWallet.address,
              to: tx.to,
              data: tx.data ?? '0x',
              value: numberToHex(BigInt(tx.value ?? '0')),
              chainId: numberToHex(evmChains[tx.chain].id),
            },
          ],
        });
        return { chain: tx.chain, id: String(hash) };
      }

      if (!solWallet) throw new Error('Solana wallet is not ready');
      const provider = await solWallet.getProvider();
      const transaction = VersionedTransaction.deserialize(Buffer.from(tx.transaction, 'base64'));
      const { signature } = await provider.request({
        method: 'signAndSendTransaction',
        params: { transaction, connection: solanaConnection },
      });
      return { chain: 'solana', id: signature };
    },
    [ethWallet, solWallet],
  );

  return { ready: !!ethWallet && !!solWallet, send };
}
