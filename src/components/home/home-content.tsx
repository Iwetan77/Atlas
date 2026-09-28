import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { BalanceState } from '@/api/balance';
import { BalanceCard } from '@/components/home/balance-card';
import { Holdings } from '@/components/home/holdings';
import { NextSteps } from '@/components/next-steps';
import { PromoBanner } from '@/components/promo-banner';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { showDevTools } from '@/config';
import { useSettings } from '@/settings/context';

const WELCOME = {
  id: 'welcome',
  eyebrow: 'New',
  title: 'Welcome to Atlas',
  body: 'One balance for everything: stocks, memes, crypto, and cash out to your bank.',
};

// Home layout, fed by a balance source. The real screen passes the engine balance; the testnet
// preview passes labelled sample data.
export function HomeContent({ balance, banner }: { balance: BalanceState; banner?: string }) {
  const { stealthMode, showEmptyPockets, displayCurrency, update } = useSettings();
  const { data } = balance;
  const hasFunds = !!data && Number(data.total.amount) > 0;

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Atlas</Text>
        {showDevTools ? (
          <Pressable onPress={() => router.push('/dev')} hitSlop={8}>
            <Text variant="label" color="accentPinkTint">
              Dev
            </Text>
          </Pressable>
        ) : null}
      </View>

      {banner ? (
        <Text variant="caption" color="accentPinkTint">
          {banner}
        </Text>
      ) : null}

      <BalanceCard
        balance={data}
        loading={balance.loading}
        error={balance.error}
        stealth={stealthMode}
        onToggleStealth={() => update({ stealthMode: !stealthMode })}
        onRetry={balance.refresh}
        onDeposit={() => router.push('/deposit')}
      />

      {data ? (
        <Holdings
          holdings={data.holdings}
          currency={displayCurrency}
          showEmptyPockets={showEmptyPockets}
          stealth={stealthMode}
        />
      ) : null}

      <NextSteps
        steps={[
          {
            key: 'deposit',
            title: 'Make a deposit',
            subtitle: 'Add money in naira or crypto',
            done: hasFunds,
            onPress: () => router.push('/deposit'),
          },
        ]}
      />

      <PromoBanner promo={WELCOME} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
