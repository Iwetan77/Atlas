import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { BalanceState } from '@/api/balance';
import type { SpotPositionsState } from '@/api/positions';
import { useMe } from '@/api/send';
import { useAtlasAuth } from '@/auth/context';
import { HeroBalance } from '@/components/home/hero-balance';
import { RecentTransactions } from '@/components/home/recent-transactions';
import { EarnCard } from '@/components/home/earn-card';
import { YourAssets } from '@/components/home/your-assets';
import { PendingPurchases } from '@/components/home/pending-purchases';
import { NextSteps } from '@/components/next-steps';
import { ProfileAvatar } from '@/components/profile-avatar';
import { PromoBanner, type Promo } from '@/components/promo-banner';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAddMoney } from '@/funding/add-money';
import { useSettings } from '@/settings/context';
import { colors, radii } from '@/theme';
import { useDesktop } from '@/web/use-desktop';
import { DesktopHome } from '@/components/web/home';

// Home layout, fed by a balance source. The real screen passes the engine balance; the testnet
// preview passes labelled sample data.
export function HomeContent({
  balance,
  positions,
  banner,
}: {
  balance: BalanceState;
  positions: SpotPositionsState;
  banner?: string;
}) {
  const { email } = useAtlasAuth();
  const desktop = useDesktop();
  const addMoney = useAddMoney();
  const { me, reload: reloadMe } = useMe();
  const { reload: reloadPositions } = positions;
  // Coming back from the handle screen should tick the step straight away; back from a trade, the
  // cards should show it.
  useFocusEffect(
    useCallback(() => {
      reloadMe();
      reloadPositions();
    }, [reloadMe, reloadPositions]),
  );
  // Each balance refresh (it polls) brings the cards' live values along.
  const asOf = balance.data?.asOfUnixMs;
  useEffect(() => {
    if (asOf) reloadPositions();
  }, [asOf, reloadPositions]);
  const { stealthMode, showEmptyPockets, displayCurrency, dismissedPromos, update } = useSettings();
  const { data } = balance;
  const hasFunds = !!data && Number(data.total.amount) > 0;

  // Pulling Home down reloads everything on it; the spinner stays until the balance, assets and
  // profile are back (history and Earn follow on their own).
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshBalance = balance.refresh;
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    void Promise.allSettled([refreshBalance(), reloadPositions(), reloadMe()]).finally(() => setRefreshing(false));
  }, [refreshBalance, reloadPositions, reloadMe]);

  const welcome: Promo = {
    id: 'welcome',
    title: 'Welcome to Atlas',
    body: 'One balance for stocks, memes and crypto. Cash out to your bank any time.',
    art: 'planet',
    cta: { label: 'Explore', onPress: () => router.push('/trade') },
  };

  if (desktop) return <Screen><DesktopHome
    greeting={me?.displayName?.split(' ')[0] || me?.handle || 'there'} onRefresh={onRefresh} refreshing={refreshing} onDeposit={addMoney}
    hero={<HeroBalance balance={data} loading={balance.loading} error={balance.error} currency={displayCurrency} stealth={stealthMode} showEmptyPockets={showEmptyPockets} onToggleStealth={() => update({ stealthMode: !stealthMode })} onRetry={balance.refresh} onDeposit={addMoney} onWithdraw={() => router.push('/send/bank')} />}
    pending={<>{banner ? <Text variant="caption" color="accentPinkTint">{banner}</Text> : null}<PendingPurchases onFinished={balance.refresh} /></>}
    assets={<YourAssets balance={data} positions={positions.data} stealth={stealthMode} />}
    earn={<EarnCard stealth={stealthMode} refreshKey={refreshKey} />}
    activity={<RecentTransactions stealth={stealthMode} refreshKey={refreshKey} />}
    nextSteps={me && data ? <NextSteps steps={[
      { key: 'account', title: 'Create your account', subtitle: 'Your wallet is ready', done: true },
      { key: 'handle', title: 'Pick your @handle', subtitle: 'Friends can send you money with it', done: !!me.handle, action: { label: 'Pick', onPress: () => router.push('/handle') } },
      { key: 'deposit', title: 'Make a deposit', subtitle: "Then you're ready", done: hasFunds, action: { label: 'Deposit', onPress: addMoney } },
    ]} /> : null}
    promo={dismissedPromos.includes(welcome.id) ? null : <PromoBanner promo={welcome} onDismiss={() => update({ dismissedPromos: [...dismissedPromos, welcome.id] })} />}
  /></Screen>;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Profile and settings"
          style={styles.avatarRing}>
          <ProfileAvatar photo={me?.avatar} initial={(email?.[0] ?? 'A').toUpperCase()} size={40} />
        </Pressable>
      </View>

      {banner ? (
        <Text variant="caption" color="accentPinkTint">
          {banner}
        </Text>
      ) : null}

      <HeroBalance
        balance={data}
        loading={balance.loading}
        error={balance.error}
        currency={displayCurrency}
        stealth={stealthMode}
        showEmptyPockets={showEmptyPockets}
        onToggleStealth={() => update({ stealthMode: !stealthMode })}
        onRetry={balance.refresh}
        onDeposit={addMoney}
        onWithdraw={() => router.push('/send/bank')}
      />

      <PendingPurchases onFinished={balance.refresh} />

      <YourAssets balance={data} positions={positions.data} stealth={stealthMode} />

      <EarnCard stealth={stealthMode} refreshKey={refreshKey} />

      <RecentTransactions stealth={stealthMode} refreshKey={refreshKey} />

      {/* Only once who they are and what they hold are known: no "Pick your @handle" or "Make a
          deposit" flashing at someone who already has both. */}
      {me && data ? (
        <NextSteps
          steps={[
            { key: 'account', title: 'Create your account', subtitle: 'Your wallet is ready', done: true },
            {
              key: 'handle',
              title: 'Pick your @handle',
              subtitle: 'Friends can send you money with it',
              done: !!me?.handle,
              action: { label: 'Pick', onPress: () => router.push('/handle') },
            },
            {
              key: 'deposit',
              title: 'Make a deposit',
              subtitle: "Then you're ready",
              done: hasFunds,
              action: { label: 'Deposit', onPress: addMoney },
            },
          ]}
        />
      ) : null}

      {dismissedPromos.includes(welcome.id) ? null : (
        <PromoBanner promo={welcome} onDismiss={() => update({ dismissedPromos: [...dismissedPromos, welcome.id] })} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.accentPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
