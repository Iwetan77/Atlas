import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Switch, View } from 'react-native';

import type { DisplayCurrency } from '@/api/contract';
import { usePerpsAccess } from '@/api/perps';
import { setAvatar, useMe } from '@/api/send';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { PerpsAccessSettings } from '@/components/perps/enable-perps';
import { ProfileAvatar } from '@/components/profile-avatar';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { SelectSheet } from '@/components/ui/select-sheet';
import { Text } from '@/components/ui/text';
import { currencySymbol } from '@/format/money';
import { useSettings } from '@/settings/context';
import { colors, radii, spacing } from '@/theme';

const CURRENCIES: { code: DisplayCurrency; label: string; flag: string }[] = [
  { code: 'NGN', label: 'Nigerian naira', flag: '🇳🇬' },
  { code: 'USD', label: 'US dollar', flag: '🇺🇸' },
  { code: 'EUR', label: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', label: 'British pound', flag: '🇬🇧' },
  { code: 'ZAR', label: 'South African rand', flag: '🇿🇦' },
  { code: 'KES', label: 'Kenyan shilling', flag: '🇰🇪' },
  { code: 'GHS', label: 'Ghanaian cedi', flag: '🇬🇭' },
];

// Square-cropped by the picker, then shrunk to 256px so it stays a few dozen KB.
async function choosePhoto(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  const image = await ImageManipulator.manipulate(picked.assets[0].uri).resize({ width: 256 }).renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null;
}

export default function ProfileScreen() {
  const { email, logout, getAccessToken } = useAtlasAuth();
  const { me, reload, setMe } = useMe();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const updatePhoto = async (remove: boolean) => {
    setPhotoError(null);
    try {
      const image = remove ? null : await choosePhoto();
      if (!remove && !image) return;
      setPhotoBusy(true);
      const saved = await setAvatar(getAccessToken, image);
      if (me) setMe({ ...me, avatar: saved });
    } catch (e) {
      setPhotoError(`Couldn't update your photo: ${errorMessage(e)}`);
    } finally {
      setPhotoBusy(false);
    }
  };
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const { displayCurrency, stealthMode, showEmptyPockets, update } = useSettings();
  const perps = usePerpsAccess();

  return (
    <Screen>
      <BackHeader title="Profile" />

      <Card style={styles.identity}>
        <Pressable
          onPress={() => updatePhoto(false)}
          disabled={photoBusy}
          accessibilityRole="button"
          accessibilityLabel={me?.avatar ? 'Change profile photo' : 'Add a profile photo'}
          style={styles.photo}>
          <ProfileAvatar photo={me?.avatar} initial={(email?.[0] ?? 'A').toUpperCase()} size={72} />
          <View style={styles.photoBadge}>
            {photoBusy ? (
              <ActivityIndicator size="small" color={colors.textOnAccent} />
            ) : (
              <Icon name="camera" size={14} color="textOnAccent" />
            )}
          </View>
        </Pressable>
        {me?.avatar ? (
          <Pressable onPress={() => updatePhoto(true)} disabled={photoBusy} hitSlop={8}>
            <Text variant="label" color="textSecondary">
              Remove photo
            </Text>
          </Pressable>
        ) : null}
        {photoError ? <Text color="danger">{photoError}</Text> : null}
        <Text variant="heading">{me?.handle ? `@${me.handle}` : (email ?? 'Atlas user')}</Text>
        {me?.handle && email ? (
          <Text variant="caption" color="textSecondary">
            {email}
          </Text>
        ) : null}
        {me && !me.handle ? (
          <Pressable onPress={() => router.push('/handle')} hitSlop={8}>
            <Text variant="label" color="accentPinkTint">
              Pick your @handle
            </Text>
          </Pressable>
        ) : null}
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
          <SelectSheet
            title="Currency"
            value={displayCurrency}
            onChange={(code) => update({ displayCurrency: code })}
            items={CURRENCIES.map((c) => ({
              key: c.code,
              label: c.label,
              detail: `${c.code} · ${currencySymbol(c.code).trim()}`,
              leading: c.flag,
            }))}
          />
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

      {perps.authorized ? (
        <>
          <Text variant="overline" color="textSecondary">
            Perps
          </Text>
          <PerpsAccessSettings access={perps} />
        </>
      ) : null}

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
  photo: {
    width: 72,
    height: 72,
  },
  photoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPink,
    borderWidth: 2,
    borderColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
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
  divider: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
  },
});
