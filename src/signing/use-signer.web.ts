// Web signer: Privy React SDK with wallet UIs forced off, so the confirm sheet stays the only prompt.
// The user's own wallet session sends every transaction and pays its own gas: Privy sponsorship is
// never requested.
import { useAuthorizationSignature, useSendTransaction, useSignTypedData } from '@privy-io/react-auth';
import { useSignAndSendTransaction, useSignTransaction, useWallets } from '@privy-io/react-auth/solana';
import { getBase58Decoder } from '@solana/kit';
import { Buffer } from 'buffer';
import { useCallback } from 'react';

import type { PrivyApprovalRequest, SentTx, UnsignedTx } from '@/api/contract';
import { useAtlasAuth } from '@/auth/context';
import { solana } from '@/config';
import { evmChainFor } from '@/signing/chains';
import type { Signer } from '@/signing/types';

const noWalletUi = { showWalletUIs: false } as const;

export function useSigner(): Signer {
  const { wallets: addresses } = useAtlasAuth();
  const { signTypedData } = useSignTypedData();
  const { sendTransaction } = useSendTransaction();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { signTransaction } = useSignTransaction();
  const { wallets: solanaWallets } = useWallets();
  const { generateAuthorizationSignature } = useAuthorizationSignature();

  const solWallet = solanaWallets.find((w) => w.address === addresses.solana);

  const send = useCallback(
    async (tx: UnsignedTx): Promise<SentTx> => {
      if ('typedData' in tx) throw new Error('Typed data is signed, not sent');
      if (tx.chain === 'privy') throw new Error('A Privy approval is signed, not sent');
      if (tx.chain !== 'solana') {
        // One EVM address serves every EVM chain; it's labelled "base" because Base is the default.
        if (!addresses.base) throw new Error('EVM wallet is not ready');
        const chainId = evmChainFor(tx).id;
        const { hash } = await sendTransaction(
          {
            to: tx.to,
            data: tx.data ?? '0x',
            value: BigInt(tx.value ?? '0'),
            chainId,
          },
          { address: addresses.base, uiOptions: noWalletUi },
        );
        return { chain: tx.chain, id: hash };
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

  const sign = useCallback(
    async (tx: UnsignedTx): Promise<string> => {
      if ('typedData' in tx) {
        if (!addresses.base) throw new Error('EVM wallet is not ready');
        const { signature } = await signTypedData(tx.typedData, { address: addresses.base, uiOptions: noWalletUi });
        return signature;
      }
      if (tx.chain !== 'solana') throw new Error('Only Solana transactions are engine-submitted');
      if (!solWallet) throw new Error('Solana wallet is not ready');
      const { signedTransaction } = await signTransaction({
        transaction: new Uint8Array(Buffer.from(tx.transaction, 'base64')),
        wallet: solWallet,
        chain: solana.chainId,
        options: { uiOptions: noWalletUi },
      });
      return Buffer.from(signedTransaction).toString('base64');
    },
    [solWallet, signTransaction, addresses.base, signTypedData],
  );

  const approve = useCallback(
    async (request: PrivyApprovalRequest): Promise<string> =>
      (await generateAuthorizationSignature(request)).signature,
    [generateAuthorizationSignature],
  );

  return { ready: !!addresses.base && !!solWallet, send, sign, approve };
}
