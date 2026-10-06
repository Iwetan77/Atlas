// Native signer: Privy Expo SDK embedded wallets. The Expo SDK has no signing UI of its own,
// so nothing here can prompt the user.
import { useAuthorizationSignature, useEmbeddedEthereumWallet, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { useCallback, useEffect, useRef } from 'react';
import { numberToHex } from 'viem';

import { predictionGeo } from '@/api/predictions';
import type { PrivyApprovalRequest, SentTx, UnsignedTx } from '@/api/contract';
import { evmChainFor, solanaConnection } from '@/signing/chains';
import type { Signer } from '@/signing/types';

export function useSigner(): Signer {
  const eth = useEmbeddedEthereumWallet();
  const sol = useEmbeddedSolanaWallet();

  const { generateAuthorizationSignature } = useAuthorizationSignature();
  const ethWallet = eth.wallets[0];
  // Privy can report the Solana wallet as connecting or reconnecting for a while on Android while
  // it is there and usable (its provider waits for the connection). One that needs recovery recovers
  // itself first (below); one that doesn't exist yet, or is disconnected, can't sign.
  const usable = sol.status === 'connected' || sol.status === 'connecting' || sol.status === 'reconnecting';
  const solWallet = usable ? sol.wallets?.[0] : undefined;
  // A wallet that needs recovering recovers itself (Privy's own recovery, no prompt), once.
  const recovering = useRef(false);
  useEffect(() => {
    if (sol.status !== 'needs-recovery' || recovering.current || !sol.recover) return;
    recovering.current = true;
    sol.recover().catch((e: unknown) => console.warn('[atlas] Solana wallet recovery failed', e)).finally(() => { recovering.current = false; });
  }, [sol]);

  const send = useCallback(
    async (tx: UnsignedTx): Promise<SentTx> => {
      if ('typedData' in tx) throw new Error('Typed data is signed, not sent');
      if (tx.chain === 'privy') throw new Error('A Privy approval is signed, not sent');
      if (tx.chain !== 'solana') {
        if (!ethWallet) throw new Error('EVM wallet is not ready');
        // Sent by the user's own wallet session, paid from its own ETH (plans top the tank up first
        // when it's empty). The engine checks every hash against the plan it made.
        const chainId = evmChainFor(tx).id;
        const provider = await ethWallet.getProvider();
        const hash = await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: ethWallet.address,
              to: tx.to,
              data: tx.data ?? '0x',
              value: numberToHex(BigInt(tx.value ?? '0')),
              chainId: numberToHex(chainId),
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

  const sign = useCallback(
    async (tx: UnsignedTx): Promise<string> => {
      if ('typedData' in tx) {
        if (tx.chain === 'polygon' && !await predictionGeo()) throw new Error('Predictions trading is not available in your location.');
        if (!ethWallet) throw new Error('EVM wallet is not ready');
        const provider = await ethWallet.getProvider();
        return String(await provider.request({ method: 'eth_signTypedData_v4',
          params: [ethWallet.address, JSON.stringify(tx.typedData)] }));
      }
      if (tx.chain !== 'solana') throw new Error('Only Solana transactions are engine-submitted');
      if (!solWallet) throw new Error('Solana wallet is not ready');
      const provider = await solWallet.getProvider();
      const transaction = VersionedTransaction.deserialize(Buffer.from(tx.transaction, 'base64'));
      const { signedTransaction } = await provider.request({ method: 'signTransaction', params: { transaction } });
      return Buffer.from(signedTransaction.serialize()).toString('base64');
    },
    [solWallet, ethWallet],
  );

  const approve = useCallback(
    async (request: PrivyApprovalRequest): Promise<string> =>
      (await generateAuthorizationSignature(request)).signature,
    [generateAuthorizationSignature],
  );

  const ready = !!ethWallet && !!solWallet;
  const waiting = ready ? null : !ethWallet || sol.status === 'not-created' || sol.status === 'creating'
    ? 'Setting up your wallet…'
    : sol.status === 'disconnected' || sol.status === 'error'
      ? "Your wallet isn't connected. Close Atlas fully and open it again."
      : 'Connecting your wallet…';
  return { ready, waiting, send, sign, approve };
}
