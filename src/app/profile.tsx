import { type ReactNode } from 'react';
import { Pressable, Share, StyleSheet, Switch, View } from 'react-native';

import type { DisplayCurrency } from '@/api/contract';
import { useAtlasAuth } from '@/auth/context';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useSettings } from '@/settings/context';
import { colors, radii, spacing } from '@/theme';

// NGN and USD at launch; KES/GHS/ZAR join once these two are solid.
const CURRENCIES: { code: DisplayCurrency; label: string }[] = [
  { code: 'NGN', label: 'Naira' },
  { code: 'USD', label: 'US Dollar' },
];

export default function ProfileScreen() {
  const { email, logout } = useAtlasAuth();
  const { displayCurrency, stealthMode, showEmptyPockets, update } = useSettings();

  return (
    <Screen>
      <BackHeader title="Profile" />

      <Card style={styles.identity}>
        <View style={styles.bigAvatar}>
          <Text variant="title" color="accentPinkTint">
            {(email?.[0] ?? 'A').toUpperCase()}
          </Text>
        </View>
        <Text variant="heading">{email ?? 'Atlas user'}</Text>
        {/* Privy wallets come back with the login itself: no seed phrase to write down. */}
        <View style={styles.backedUp}>
          <Icon name="shield-checkmark" size={14} color="success" />
          <Text variant="label" color="success">
            Backed up with your login
          </Text>
        </View>
      </Card>

      <Text variant="overline" color="textSecondary">
        Display
      </Text>
      <Card style={styles.group}>
        <View style={styles.rowStack}>
          <RowLabel icon="cash-outline" title="Currency" subtitle="Balances and prices show in this currency" />
          <View style={styles.chips}>
            {CURRENCIES.map((c) => {
              const active = c.code === displayCurrency;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => update({ displayCurrency: c.code })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[
                    styles.chip,
                    active
                      ? { backgroundColor: colors.accentPinkDim, borderColor: colors.accentPink }
                      : { borderColor: colors.border },
                  ]}>
                  <Text variant="label" color={active ? 'accentPinkTint' : 'textSecondary'}>
                    {c.code} · {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Divider />
        <ToggleRow
          icon="eye-off-outline"
          title="Stealth mode"
          subtitle="Hide balances on screen"
          value={stealthMode}
          onChange={(v) => update({ stealthMode: v })}
        />
        <Divider />
        <ToggleRow
          icon="wallet-outline"
          title="Show empty pockets"
          subtitle="List assets with a zero balance"
          value={showEmptyPockets}
          onChange={(v) => update({ showEmptyPockets: v })}
        />
      </Card>

      <Text variant="overline" color="textSecondary">
        More
      </Text>
      <Card style={styles.group}>
        <Pressable
          onPress={() => Share.share({ message: 'I use Atlas for one balance across stocks, memes and crypto. Join me.' })}
          style={styles.row}>
          <RowLabel icon="gift-outline" title="Invite friends" subtitle="Share Atlas with people you pay" />
          <Icon name="chevron-forward" size={18} color="accentPink" />
        </Pressable>
      </Card>

      <PillButton label="Sign out" icon="log-out-outline" tone="secondary" onPress={logout} />
    </Screen>
  );
}

function RowLabel({ icon, title, subtitle }: { icon: IconName; title: string; subtitle: string }) {
  return (
    <View style={styles.rowLabel}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={18} color="accentPinkTint" />
      </View>
      <View style={styles.rowText}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="textSecondary">
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function ToggleRow(props: {
  icon: IconName;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}): ReactNode {
  return (
    <View style={styles.row}>
      <RowLabel icon={props.icon} title={props.title} subtitle={props.subtitle} />
      <Switch
        value={props.value}
        onValueChange={props.onChange}
        trackColor={{ false: colors.textDisabled, true: colors.accentPink }}
        thumbColor={colors.textPrimary}
        ios_backgroundColor={colors.textDisabled}
      />
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  identity: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  bigAvatar: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.accentPink,
    backgroundColor: colors.accentPinkDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  backedUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.successDim,
  },
  group: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowStack: {
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
  },
});
