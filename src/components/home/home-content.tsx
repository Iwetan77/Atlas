import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { BalanceState } from '@/api/balance';
import { useMe } from '@/api/send';
import { useAtlasAuth } from '@/auth/context';
import { HeroBalance } from '@/components/home/hero-balance';
import { NextSteps } from '@/components/next-steps';
import { PromoBanner, type Promo } from '@/components/promo-banner';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useSettings } from '@/settings/context';
import { colors, radii } from '@/theme';

// Home layout, fed by a balance source. The real screen passes the engine balance; the testnet
// preview passes labelled sample data.
export function HomeContent({ balance, banner }: { balance: BalanceState; banner?: string }) {
  const { email } = useAtlasAuth();
  const { me, reload: reloadMe } = useMe();
  // Coming back from the handle screen should tick the step straight away.
  useFocusEffect(
    useCallback(() => {
      reloadMe();
    }, [reloadMe]),
  );
  const { stealthMode, showEmptyPockets, displayCurrency, dismissedPromos, update } = useSettings();
  const { data } = balance;
  const hasFunds = !!data && Number(data.total.amount) > 0;

  const welcome: Promo = {
    id: 'welcome',
    title: 'Welcome to Atlas',
    body: 'One balance for stocks, memes and crypto. Cash out to your bank any time.',
    art: 'planet',
    cta: { label: 'Explore', onPress: () => router.push('/trade') },
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Profile and settings"
          style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text variant="heading" color="accentPinkTint">
              {(email?.[0] ?? 'A').toUpperCase()}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push('/deposit')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Your QR code">
          <Icon name="qr-code-outline" size={28} color="textPrimary" />
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
        onDeposit={() => router.push('/deposit')}
      />

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
            action: { label: 'Deposit', onPress: () => router.push('/deposit') },
          },
        ]}
      />

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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
