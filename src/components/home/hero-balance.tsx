import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { BalanceResponse, DisplayCurrency } from '@/api/contract';
import { elsewhereAmount, pocketMoney, pocketsLive, spendableAmount, tradingAmount } from '@/api/pockets';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatMoney, formatUsd, hiddenMoney } from '@/format/money';
import { openMove } from '@/funding/move-money';
import { colors, radii, spacing, themedStyles } from '@/theme';

type Props = {
  balance: BalanceResponse | null;
  loading: boolean;
  error: string | null;
  currency: DisplayCurrency;
  stealth: boolean;
  onToggleStealth: () => void;
  onRetry: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
};

// The hero card in Atlas pink: one number in the user's currency, the two money-in/money-out
// actions, and folded inside behind the chevron tab the two balances it's made of: Spendable (sends,
// cash-outs, savings) and Trading (trades, perps, predictions). The rest is savings, perps margin
// and coins, under Your assets and Earn.
export function HeroBalance(props: Props) {
  const { balance, loading, error, currency, stealth } = props;
  const [open, setOpen] = useState(false);
  const show = (amount: number) =>
    balance ? (stealth ? hiddenMoney(balance.total.currency) : formatMoney(pocketMoney(balance, amount))) : '';
  // What savings, perps and coins add, so the two cards plus this line make the total.
  const elsewhere = balance ? elsewhereAmount(balance) : 0;

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
          <HeroAction icon="arrow-up" label="Send" onPress={props.onWithdraw} />
        </View>

        {open && balance ? (
          <View style={styles.breakdown}>
            <View style={styles.divider} />
            <View style={styles.pockets}>
              <PocketCard
                icon="wallet-outline"
                name="Spendable"
                uses="Send, cash out, save"
                amount={show(spendableAmount(balance))}
                onPress={props.onWithdraw}
              />
              <PocketCard
                icon="trending-up"
                name="Trading"
                uses="Trade, perps, predictions"
                amount={show(tradingAmount(balance))}
                onPress={() => router.push('/trade')}
                onAdd={pocketsLive(balance) ? () => openMove('to_trading') : undefined}
              />
            </View>
            {elsewhere >= 0.01 ? (
              <Text variant="caption" color="textOnAccent" style={styles.center}>
                + {show(elsewhere)} in your assets below
              </Text>
            ) : null}
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

// One of the two balances, on a white card: tap it to use it; Trading also has Add (from Spendable).
function PocketCard({ icon, name, uses, amount, onPress, onAdd }: {
  icon: IconName; name: string; uses: string; amount: string; onPress?: () => void; onAdd?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} balance ${amount}`}
      style={({ pressed }) => [styles.pocket, pressed && styles.pocketPressed]}>
      <View style={styles.pocketIcon}>
        <Icon name={icon} size={18} color="tilePinkInk" />
      </View>
      <View style={styles.pocketBody}>
        <Text variant="bodyStrong" color="textOnLight" numberOfLines={1}>{name}</Text>
        <Text variant="caption" color="textDisabled" numberOfLines={2} style={styles.pocketUses}>
          {uses}
        </Text>
      </View>
      {/* The amount in the middle of the row: then its arrow, or Trading's Add under it. */}
      <View style={styles.pocketSide}>
        <View style={styles.pocketValue}>
          <Text variant="heading" color="textOnLight" numberOfLines={1} adjustsFontSizeToFit
            style={[styles.pocketAmount, amount.length > 9 && styles.pocketAmountLong]}>
            {amount}
          </Text>
          {onAdd ? null : <Icon name="chevron-forward" size={16} color="textDisabled" />}
        </View>
        {onAdd ? (
          <Pressable onPress={onAdd} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Add money to ${name}`} style={styles.add}>
            <Icon name="add" size={14} color="textOnAccent" />
            <Text variant="label" color="textOnAccent">Add</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
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

const styles = themedStyles(() => ({
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
  // The two balances, one full-width row each: the name over what it's for, and the amount in the
  // middle of the row with its arrow (or Trading's Add).
  pockets: {
    gap: spacing.sm,
  },
  pocket: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    gap: spacing.sm + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLight,
  },
  pocketPressed: {
    transform: [{ scale: 0.98 }],
  },
  pocketIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tilePink,
  },
  pocketBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pocketSide: {
    flexShrink: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pocketValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  pocketAmount: {
    flexShrink: 1,
    textAlign: 'right',
  },
  // A long figure (₦79,707.60 and up) steps down so the name and its line keep their room.
  pocketAmountLong: {
    fontSize: 15,
    lineHeight: 20,
  },
  // Both descriptions the same small size, so the longer one never reaches the Add button.
  pocketUses: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPink,
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
    backgroundColor: colors.accentPinkDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
