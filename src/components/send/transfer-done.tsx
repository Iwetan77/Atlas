import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Share, View } from 'react-native';

import type { Bank, Money } from '@/api/contract';
import { bankTransferProgress, useTransactionReceipt } from '@/api/transactions';
import { BankLogo } from '@/components/send/bank-picker';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/format/money';
import { colors, radii, spacing, themedStyles } from '@/theme';

export type DoneTransfer = {
  intentId: string;
  bank: Bank;
  accountNumber: string;
  accountName: string;
  // What the bank gets, what left the balance, and the fee.
  receive: Money;
  send: Money;
  fee: Money;
  eta: string;
};

// After a bank transfer: the amount, who it's for, and what to do next (share a receipt, keep the
// account as a favorite, open the transaction, send another).
export function TransferDone({
  transfer: t,
  favorite,
  onFavorite,
  onAnother,
}: {
  transfer: DoneTransfer;
  favorite: boolean;
  onFavorite: () => void;
  onAnother: () => void;
}) {
  const { receipt: live, error } = useTransactionReceipt(t.intentId);
  const progress = bankTransferProgress(live);
  const [openedAt] = useState(() => Date.now());
  const when = new Date(live?.createdAtUnixMs || openedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const receipt = [
    'Atlas transfer receipt',
    `${formatMoney(t.receive)} to ${t.accountName}`,
    `${t.bank.name} · ${t.accountNumber}`,
    `You pay ${formatMoney(t.send)} (fee ${formatMoney(t.fee)})`,
    `Status: ${progress.title}`,
    when,
    `Reference: ${t.intentId}`,
  ].join('\n');

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={() => router.navigate('/')} hitSlop={10} accessibilityRole="button">
          <Text variant="bodyStrong" color="accentPinkTint">
            Done
          </Text>
        </Pressable>
      </View>
      <View style={styles.hero}>
        <View style={[styles.check, !progress.done && styles.pendingOrb]}>
          {progress.done ? <Icon name="checkmark" size={38} color="textOnAccent" /> : progress.failed ? <Icon name="alert-circle-outline" size={36} color="danger" /> :
            <><ActivityIndicator size="large" color={colors.accentPink} style={styles.spinner} /><Icon name="paper-plane-outline" size={25} color="accentPinkTint" /></>}
        </View>
        <View accessibilityLiveRegion="polite" style={styles.statusText}>
          <Text variant="heading" style={styles.center}>{progress.title}</Text>
          <Text variant="display" style={styles.center}>{formatMoney(t.receive)}</Text>
          <Text color="textSecondary" style={styles.center}>{progress.detail}</Text>
        </View>
        {!progress.failed ? <View style={styles.journey}>
          {['Sending', 'Bank payout', 'Complete'].map((label, index) => <View key={label} style={styles.step}>
            <View style={[styles.dot, index <= progress.step && styles.activeDot]}>
              {index < progress.step || progress.done ? <Icon name="checkmark" size={12} color="textOnAccent" /> : <View style={styles.dotCore} />}
            </View>
            <Text variant="caption" color={index <= progress.step ? 'textPrimary' : 'textSecondary'}>{label}</Text>
          </View>)}
        </View> : null}
        {error && !progress.done ? <Text variant="caption" color="textSecondary" style={styles.center}>Connection is slow. We’re still checking your transfer.</Text> : null}
      </View>

      <Card style={styles.payee}>
        <BankLogo bank={t.bank} size={40} />
        <View style={styles.payeeText}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {t.accountName}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {t.bank.name} · {t.accountNumber}
          </Text>
        </View>
      </Card>

      <View style={styles.tiles}>
        <Tile icon="share-social-outline" label="Share receipt" onPress={() => Share.share({ message: receipt })} />
        <Tile
          icon={favorite ? 'star' : 'star-outline'}
          label={favorite ? 'In favorites' : 'Save account'}
          onPress={onFavorite}
        />
        <Tile
          icon="receipt-outline"
          label="View details"
          onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.intentId } })}
        />
        {progress.done || progress.failed ? <Tile icon="repeat-outline" label="Send another" onPress={onAnother} /> : null}
      </View>

      <PillButton label="Done" onPress={() => router.navigate('/')} />
    </Screen>
  );
}

function Tile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.tileIcon}>
        <Icon name={icon} size={20} color="accentPink" />
      </View>
      <Text variant="label" numberOfLines={1} style={styles.tileText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  top: {
    alignItems: 'flex-end',
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  check: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Atlas pink with a black tick, like every other "done" screen.
    backgroundColor: colors.accentPink,
  },
  pendingOrb: { backgroundColor: colors.accentPinkDim, width: 88, height: 88 },
  spinner: { position: 'absolute', transform: [{ scale: 1.7 }] },
  statusText: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  journey: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.sm },
  step: { flex: 1, alignItems: 'center', gap: spacing.sm },
  dot: { width: 22, height: 22, borderRadius: radii.pill, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  activeDot: { backgroundColor: colors.accentPink },
  dotCore: { width: 5, height: 5, borderRadius: radii.pill, backgroundColor: colors.textOnAccent },
  payee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  payeeText: {
    flex: 1,
    gap: spacing.xxs,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.bgSurface,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPinkDim,
  },
  tileText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
}));
