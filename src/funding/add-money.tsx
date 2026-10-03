import { router } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAtlasAuth } from '@/auth/context';
import { type Choice, ChoiceSheet } from '@/components/ui/choice-sheet';
import { SelectSheet } from '@/components/ui/select-sheet';
import { CURRENCIES } from '@/format/currencies';
import { useSettings } from '@/settings/context';

const AddMoneyContext = createContext<(() => void) | null>(null);

// Opens the Add money sheet from anywhere: Home's Deposit, or an "Add money" button under a
// "Not enough in your balance" message.
export function useAddMoney() {
  const open = useContext(AddMoneyContext);
  if (!open) throw new Error('useAddMoney must be used inside <AddMoneyProvider>');
  return open;
}

export function AddMoneyProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { authenticated } = useAtlasAuth();
  const show = useCallback(() => setOpen(true), []);
  return (
    <AddMoneyContext.Provider value={show}>
      {children}
      <AddMoneySheet visible={open && authenticated} onClose={() => setOpen(false)} />
    </AddMoneyContext.Provider>
  );
}

// Every way money comes in, one tap each. Whatever the route, it lands as one balance.
function AddMoneySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { displayCurrency, update } = useSettings();

  const methods: Choice[] = useMemo(
    () => [
      {
        key: 'bank',
        title: 'Bank transfer',
        subtitle: 'Pay in naira from any Nigerian bank',
        icon: 'business-outline',
        onPress: () => {
          onClose();
          // Back from there brings this sheet back up (see the bank transfer screen).
          router.push({ pathname: '/add-bank', params: { from: 'add-money' } });
        },
      },
      {
        key: 'wallet',
        title: 'Wallet or exchange',
        subtitle: 'USDT or USDC from Binance, Bybit, OKX or any wallet',
        logos: [
          { symbol: 'USDC', url: null },
          {
            symbol: 'BNB',
            url: 'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
          },
        ],
        onPress: () => {
          onClose();
          // Back from there brings this sheet back up (see the deposit screen).
          router.push({ pathname: '/deposit', params: { from: 'add-money' } });
        },
      },
      {
        key: 'virtual',
        title: 'Virtual bank account',
        subtitle: 'US or EU account details in your name',
        icon: 'globe-outline',
        soon: true,
      },
    ],
    [onClose],
  );

  return (
    <ChoiceSheet
      visible={visible}
      onClose={onClose}
      title="Add money"
      choices={methods}
      accessory={
        <View style={styles.currency}>
          <SelectSheet
            title="Currency"
            compact
            value={displayCurrency}
            onChange={(code) => update({ displayCurrency: code })}
            items={CURRENCIES.map((c) => ({
              key: c.code,
              label: c.code,
              detail: c.label,
              leading: c.flag,
            }))}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  currency: {
    minWidth: 110,
  },
});
