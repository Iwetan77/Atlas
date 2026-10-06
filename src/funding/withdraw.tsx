import { router, useLocalSearchParams } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { listWithdrawNetworks } from '@/api/withdraw';
import { useAtlasAuth } from '@/auth/context';
import { type Choice, ChoiceSheet } from '@/components/ui/choice-sheet';

const WithdrawContext = createContext<(() => void) | null>(null);

// Opens the Send sheet (every way money leaves) from anywhere: Home's Send, or back from one of its
// screens. Internally it's still "withdraw", as the screens' `from` parameter says.
export function useWithdraw() {
  const open = useContext(WithdrawContext);
  if (!open) throw new Error('useWithdraw must be used inside <WithdrawProvider>');
  return open;
}

// On a screen opened from the Withdraw sheet: leaving before the money goes brings the sheet back.
export function useBackToWithdraw(done: boolean) {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const open = useWithdraw();
  const finished = useRef(done);
  useEffect(() => {
    finished.current = done;
  }, [done]);
  useEffect(
    () => () => {
      if (from === 'withdraw' && !finished.current) open();
    },
    [from, open],
  );
}

export function WithdrawProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { authenticated } = useAtlasAuth();
  const show = useCallback(() => setOpen(true), []);
  return (
    <WithdrawContext.Provider value={show}>
      {children}
      <WithdrawSheet visible={open && authenticated} onClose={() => setOpen(false)} />
    </WithdrawContext.Provider>
  );
}

// Every way money leaves, one tap each, all from the one balance.
function WithdrawSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { getAccessToken } = useAtlasAuth();
  // Withdrawing to a wallet shows Soon until the engine has it switched on.
  const [walletReady, setWalletReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (!visible || walletReady) return;
    listWithdrawNetworks(getAccessToken).then(
      (r) => setWalletReady(r.enabled),
      () => setWalletReady(false),
    );
  }, [visible, walletReady, getAccessToken]);

  const choices: Choice[] = useMemo(() => {
    const go = (pathname: '/send/friend' | '/send/link' | '/send/bank' | '/send/wallet') => () => {
      onClose();
      // Back from there brings this sheet back up (see useBackToWithdraw).
      router.push({ pathname, params: { from: 'withdraw' } });
    };
    return [
      { key: 'bank', title: 'Send to bank', subtitle: 'Naira to any Nigerian bank', icon: 'business-outline', onPress: go('/send/bank') },
      { key: 'friend', title: 'Atlas Friends', subtitle: 'To any @handle, instant and free', icon: 'paper-plane-outline', onPress: go('/send/friend') },
      { key: 'link', title: 'Atlas Link', subtitle: 'Share a link anyone can claim', icon: 'link-outline', onPress: go('/send/link') },
      {
        key: 'wallet',
        title: 'Withdraw to wallet',
        subtitle: 'USDC, USDT, SOL, BTC and more',
        // The coins it pays out in, like Add money's wallet row.
        logos: [
          { symbol: 'USDC', url: null },
          { symbol: 'BTC', url: null },
        ],
        soon: walletReady === false,
        onPress: go('/send/wallet'),
      },
    ];
  }, [onClose, walletReady]);

  return <ChoiceSheet visible={visible} onClose={onClose} title="Send" choices={choices} />;
}
