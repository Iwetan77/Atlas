import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { BalanceResponse, DisplayCurrency } from '@/api/contract';
import { TokenChainLogo } from '@/components/token-chain-logo';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatMoney, formatTokenNumber, formatUsd, HIDDEN, hiddenMoney } from '@/format/money';
import { colors, radii, spacing } from '@/theme';

type Props = {
  balance: BalanceResponse | null;
  loading: boolean;
  error: string | null;
  currency: DisplayCurrency;
  stealth: boolean;
  showEmptyPockets: boolean;
  onToggleStealth: () => void;
  onRetry: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
};

// MiniPay's hero card in Atlas pink: one number in the user's currency, the two money-in/money-out
// actions, and the per-asset breakdown folded inside behind the chevron tab.
export function HeroBalance(props: Props) {
  const { balance, loading, error, currency, stealth, showEmptyPockets } = props;
  const [open, setOpen] = useState(false);
  const holdings = balance
    ? showEmptyPockets
      ? balance.holdings
      : balance.holdings.filter((h) => Number(h.amount) !== 0)
    : [];

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.wash} />

        <View style={styles.header}>
          <Text variant="bodyStrong" color="textOnAccent">
            Balance
          </Text>
          <Pressable
            onPress={props.onToggleStealth}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={stealth ? 'Show balance' : 'Hide balance'}>
            <Icon name={stealth ? 'eye-off-outline' : 'eye-outline'} size={20} color="textOnAccent" />
          </Pressable>
        </View>

        {balance ? (
          <View style={styles.figures}>
            <Text variant="display" color="textOnAccent" adjustsFontSizeToFit numberOfLines={1}>
              {stealth ? hiddenMoney(balance.total.currency) : formatMoney(balance.total)}
            </Text>
            {balance.total.currency !== 'USD' ? (
              <Text color="textOnAccent" style={styles.soft}>
                {stealth ? hiddenMoney('USD') : formatUsd(balance.totalUsd)}
              </Text>
            ) : null}
            {balance.pending ? (
              <View style={styles.chip}>
                <Icon name="time-outline" size={14} color="textOnAccent" />
                <Text variant="label" color="textOnAccent">
                  {stealth ? hiddenMoney(balance.pending.currency) : formatMoney(balance.pending)} arriving
                </Text>
              </View>
            ) : null}
            {error ? (
              <Text variant="caption" color="textOnAccent" style={styles.soft}>
                Couldn&apos;t refresh just now. Showing your last balance.
              </Text>
            ) : null}
          </View>
        ) : error && !loading ? (
          <View style={styles.figures}>
            <Text variant="title" color="textOnAccent">
              Balance unavailable
            </Text>
            {error ? (
              <Text variant="caption" color="textOnAccent" style={styles.soft} numberOfLines={2}>
                {error}
              </Text>
            ) : null}
            <Pressable onPress={props.onRetry} hitSlop={8} style={styles.retry}>
              <Icon name="refresh" size={14} color="textOnAccent" />
              <Text variant="label" color="textOnAccent">
                Try again
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.figures}>
            <View style={styles.skeleton} />
            <View style={[styles.skeleton, styles.skeletonSmall]} />
          </View>
        )}

        <View style={styles.actions}>
          <HeroAction icon="arrow-down" label="Deposit" onPress={props.onDeposit} />
          <HeroAction icon="arrow-up" label="Withdraw" onPress={props.onWithdraw} />
        </View>

        {open ? (
          <View style={styles.breakdown}>
            <View style={styles.divider} />
            {holdings.length === 0 ? (
              <Text color="textOnAccent" style={styles.center}>
                Nothing here yet. Deposit to get started.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assets}>
                {holdings.map((h) => (
                  <View key={`${h.assetId}:${h.chain}:${h.location ?? 'wallet'}`} style={styles.asset}>
                    <View style={styles.assetAvatar}>
                      <TokenChainLogo symbol={h.symbol} iconUrl={h.iconUrl ?? null} chain={h.chain} size={36} />
                    </View>
                    <Text variant="heading" color="textOnLight" numberOfLines={1}>
                      {stealth ? HIDDEN : formatTokenNumber(h.amount)}
                    </Text>
                    <Text variant="caption" color="textDisabled">
                      {h.symbol}
                      {h.location === 'gateway_pending' ? ' · Arriving' : h.location === 'perps' ? ' · In perps' : h.location === 'earn' ? ' · Earning' : ''}
                    </Text>
                    <Text variant="label" color="textOnLight">
                      {stealth ? hiddenMoney(h.value.currency) : formatMoney(h.value)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
            {currency !== 'USD' ? (
              <Text variant="caption" color="textOnAccent" style={[styles.center, styles.soft]}>
                {currency} amounts are approximate
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {balance ? (
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? 'Hide breakdown' : 'Show breakdown'}
          hitSlop={10}
          style={styles.tab}>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="textOnAccent" />
        </Pressable>
      ) : null}
    </View>
  );
}

function HeroAction({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, { opacity: onPress ? 1 : 0.55 }, pressed && { transform: [{ scale: 0.98 }] }]}>
      <View style={styles.actionIcon}>
        <Icon name={icon} size={18} color="accentPinkDeep" />
      </View>
      <Text variant="bodyStrong" color="textOnAccent">
        {label}
      </Text>
    </Pressable>
  );
}

const TAB_H = 36;

const styles = StyleSheet.create({
  wrap: {
    marginBottom: TAB_H / 2,
  },
  card: {
    backgroundColor: colors.accentPink,
    borderRadius: 28,
    padding: spacing.xl,
    paddingBottom: spacing.xl + spacing.sm,
    gap: spacing.lg,
    overflow: 'hidden',
  },
  wash: {
    position: 'absolute',
    right: -70,
    top: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.accentPinkWash,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  figures: {
    gap: spacing.xxs,
    minHeight: 76,
    justifyContent: 'center',
  },
  soft: {
    opacity: 0.85,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingVertical: spacing.xxs + 1,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.onAccentSoft,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  skeleton: {
    height: 40,
    width: '65%',
    borderRadius: radii.sm,
    backgroundColor: colors.onAccentSoft,
  },
  skeletonSmall: {
    height: 16,
    width: '30%',
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDeep,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdown: {
    gap: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.onAccentSoft,
  },
  assets: {
    gap: spacing.md,
  },
  asset: {
    width: 150,
    gap: spacing.xxs,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLight,
  },
  assetAvatar: {
    marginBottom: spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
  tab: {
    position: 'absolute',
    bottom: -TAB_H / 2,
    alignSelf: 'center',
    width: 64,
    height: TAB_H,
    borderRadius: TAB_H / 2,
    borderWidth: 3,
    borderColor: colors.bgBase,
    backgroundColor: colors.accentPinkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
