// Native signer: Privy Expo SDK embedded wallets. The Expo SDK has no signing UI of its own,
// so nothing here can prompt the user.
import { useAuthorizationSignature, useEmbeddedEthereumWallet, useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo';
import { VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { useCallback, useEffect, useRef } from 'react';
import { numberToHex } from 'viem';

import { predictionGeo } from '@/api/predictions';
import type { PrivyApprovalRequest, SentTx, UnsignedTx } from '@/api/contract';
import { evmChainFor, solanaConnection } from '@/signing/chains';
import type { Signer } from '@/signing/types';

export function useSigner(): Signer {
  const { isReady, user } = usePrivy();
  const eth = useEmbeddedEthereumWallet();
  const sol = useEmbeddedSolanaWallet();

  const { generateAuthorizationSignature } = useAuthorizationSignature();
  const ethWallet = eth.wallets[0];
  // AuthBridge owns bounded transport reconnect/recovery. Keep the current wallet session for
  // callbacks that continue after the PIN or funding, instead of retaining a startup snapshot.
  const usable = isReady && !!user && (sol.status === 'connected' || sol.status === 'connecting' || sol.status === 'reconnecting');
  const solWallet = usable ? sol.wallets?.[0] : undefined;
  const current = useRef({ ethWallet, solWallet, authenticated: isReady && !!user, userId: user?.id });
  useEffect(() => {
    current.current = { ethWallet, solWallet, authenticated: isReady && !!user, userId: user?.id };
  }, [ethWallet, solWallet, isReady, user]);

  const walletsNow = useCallback(() => {
    const value = current.current;
    if (!value.authenticated) throw new Error('Your session ended. Sign in again to continue.');
    return value;
  }, []);
  const checkSession = useCallback((session: typeof current.current) => {
    if (!current.current.authenticated || current.current.userId !== session.userId) {
      throw new Error('Your session ended. Sign in again to continue.');
    }
  }, []);
  useEffect(() => () => { current.current = { ...current.current, authenticated: false }; }, []);

  const send = useCallback(
    async (tx: UnsignedTx): Promise<SentTx> => {
      const session = walletsNow();
      const { ethWallet, solWallet } = session;
      if ('typedData' in tx) throw new Error('Typed data is signed, not sent');
      if (tx.chain === 'privy') throw new Error('A Privy approval is signed, not sent');
      if (tx.chain !== 'solana') {
        if (!ethWallet) throw new Error('EVM wallet is not ready');
        // Sent by the user's own wallet session, paid from its own ETH (plans top the tank up first
        // when it's empty). The engine checks every hash against the plan it made.
        const chainId = evmChainFor(tx).id;
        const provider = await ethWallet.getProvider();
        checkSession(session);
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
      checkSession(session);
      const transaction = VersionedTransaction.deserialize(Buffer.from(tx.transaction, 'base64'));
      const { signature } = await provider.request({
        method: 'signAndSendTransaction',
        params: { transaction, connection: solanaConnection },
      });
      return { chain: 'solana', id: signature };
    },
    [walletsNow, checkSession],
  );

  const sign = useCallback(
    async (tx: UnsignedTx): Promise<string> => {
      const session = walletsNow();
      const { ethWallet, solWallet } = session;
      if ('typedData' in tx) {
        if (tx.chain === 'polygon' && !await predictionGeo()) throw new Error('Predictions trading is not available in your location.');
        if (!ethWallet) throw new Error('EVM wallet is not ready');
        const provider = await ethWallet.getProvider();
        checkSession(session);
        return String(await provider.request({ method: 'eth_signTypedData_v4',
          params: [ethWallet.address, JSON.stringify(tx.typedData)] }));
      }
      if (tx.chain !== 'solana') throw new Error('Only Solana transactions are engine-submitted');
      if (!solWallet) throw new Error('Solana wallet is not ready');
      const provider = await solWallet.getProvider();
      checkSession(session);
      const transaction = VersionedTransaction.deserialize(Buffer.from(tx.transaction, 'base64'));
      const { signedTransaction } = await provider.request({ method: 'signTransaction', params: { transaction } });
      return Buffer.from(signedTransaction.serialize()).toString('base64');
    },
    [walletsNow, checkSession],
  );

  const approve = useCallback(
    async (request: PrivyApprovalRequest): Promise<string> => {
      walletsNow();
      return (await generateAuthorizationSignature(request)).signature;
    },
    [generateAuthorizationSignature, walletsNow],
  );

  const ready = isReady && !!user && !!ethWallet && !!solWallet;
  const waiting = ready ? null : !ethWallet || sol.status === 'not-created' || sol.status === 'creating'
    ? 'Setting up your wallet…'
    : sol.status === 'disconnected' || sol.status === 'error'
      ? 'Reconnecting your wallet... Please try again shortly.'
      : 'Connecting your wallet…';
  return { ready, waiting, send, sign, approve };
}
