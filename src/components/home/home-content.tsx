import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { BalanceState } from '@/api/balance';
import { useAtlasAuth } from '@/auth/context';
import { BalanceCard } from '@/components/home/balance-card';
import { Holdings } from '@/components/home/holdings';
import { NextSteps } from '@/components/next-steps';
import { PromoBanner } from '@/components/promo-banner';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { showDevTools } from '@/config';
import { useSettings } from '@/settings/context';
import { colors, radii, spacing } from '@/theme';

const WELCOME = {
  id: 'welcome',
  eyebrow: 'New',
  title: 'Welcome to Atlas',
  body: 'One balance for everything: stocks, memes, crypto, and cash out to your bank.',
};

// Home layout, fed by a balance source. The real screen passes the engine balance; the testnet
// preview passes labelled sample data.
export function HomeContent({ balance, banner }: { balance: BalanceState; banner?: string }) {
  const { email } = useAtlasAuth();
  const { stealthMode, showEmptyPockets, displayCurrency, update } = useSettings();
  const { data } = balance;
  const hasFunds = !!data && Number(data.total.amount) > 0;
  const initial = (email?.[0] ?? 'A').toUpperCase();

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Profile and settings"
          style={styles.avatar}>
          <Text variant="heading" color="accentPinkTint">
            {initial}
          </Text>
        </Pressable>
        <Text variant="title" color="accentPink">
          atlas
        </Text>
        {showDevTools ? (
          <Pressable onPress={() => router.push('/dev')} hitSlop={8} style={styles.devChip}>
            <Icon name="construct-outline" size={14} color="accentPinkTint" />
            <Text variant="label" color="accentPinkTint">
              Dev
            </Text>
          </Pressable>
        ) : (
          <View style={styles.avatarSpacer} />
        )}
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
            icon: 'arrow-down',
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accentPink,
    backgroundColor: colors.accentPinkDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSpacer: {
    width: 40,
  },
  devChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
