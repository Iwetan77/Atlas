// Web signer: Privy React SDK with wallet UIs forced off, so the confirm sheet stays the only prompt.
import { useSendTransaction } from '@privy-io/react-auth';
import { useSignAndSendTransaction, useWallets } from '@privy-io/react-auth/solana';
import { getBase58Decoder } from '@solana/kit';
import { Buffer } from 'buffer';
import { useCallback } from 'react';

import type { SentTx, UnsignedTx } from '@/api/contract';
import { useAtlasAuth } from '@/auth/context';
import { solana } from '@/config';
import { baseChain } from '@/signing/chains';
import type { Signer } from '@/signing/types';

const noWalletUi = { showWalletUIs: false } as const;

export function useSigner(): Signer {
  const { wallets: addresses } = useAtlasAuth();
  const { sendTransaction } = useSendTransaction();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { wallets: solanaWallets } = useWallets();

  const solWallet = solanaWallets.find((w) => w.address === addresses.solana);

  const send = useCallback(
    async (tx: UnsignedTx): Promise<SentTx> => {
      if (tx.chain === 'base') {
        if (!addresses.base) throw new Error('Base wallet is not ready');
        const { hash } = await sendTransaction(
          {
            to: tx.to,
            data: tx.data ?? '0x',
            value: BigInt(tx.value ?? '0'),
            chainId: baseChain.id,
          },
          { address: addresses.base, uiOptions: noWalletUi },
        );
        return { chain: 'base', id: hash };
      }

      if (!solWallet) throw new Error('Solana wallet is not ready');
      const { signature } = await signAndSendTransaction({
        transaction: new Uint8Array(Buffer.from(tx.transaction, 'base64')),
        wallet: solWallet,
        chain: solana.chainId,
        options: { uiOptions: noWalletUi },
      });
      return { chain: 'solana', id: getBase58Decoder().decode(signature) };
    },
    [addresses.base, solWallet, sendTransaction, signAndSendTransaction],
  );

  return { ready: !!addresses.base && !!solWallet, send };
}
