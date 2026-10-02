import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MINI_APPS, miniAppIcon } from '@/components/mini-apps/catalog';
import { ChainBadge } from '@/components/token-chain-logo';
import { Field } from '@/components/ui/field';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconTile, SoonChip } from '@/components/ui/icon-tile';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { addressOrSearch } from '@/components/web-browser/address';
import { colors, radii, spacing } from '@/theme';

type Item = { title: string; subtitle: string; icon: IconName; tone: 'pink' | 'blue'; href?: Href };

const ITEMS: Item[] = [
  { title: 'Earn', subtitle: 'Savings that pay', icon: 'leaf-outline', tone: 'pink', href: '/earn' },
  { title: 'Deposit', subtitle: 'From a wallet or exchange', icon: 'arrow-down', tone: 'blue', href: '/deposit' },
  { title: 'Profile', subtitle: 'Settings & currency', icon: 'person-outline', tone: 'pink', href: '/profile' },
];

export default function MoreScreen() {
  const [search, setSearch] = useState('');
  // Words search DuckDuckGo; an address opens that site. Both in Atlas's browser, wallet not connected.
  const browse = () => {
    const url = addressOrSearch(search);
    if (!url) return;
    setSearch('');
    router.push({ pathname: '/browse', params: { url } });
  };
  return (
    <Screen>
      <Text variant="title">More</Text>

      <Field
        prefix={<Icon name="search" size={20} color="textSecondary" />}
        placeholder="Search the web or type an address"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={browse}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="web-search"
        returnKeyType="go"
        accessibilityLabel="Search the web"
      />

      <Text variant="overline" color="textSecondary">
        Mini apps
      </Text>
      <Text variant="caption" color="textSecondary">
        Apps on Base and Solana that open inside Atlas with your wallet connected. You approve every signature.
      </Text>
      <View style={styles.apps}>
        {MINI_APPS.map((app) => (
          <Pressable
            key={app.id}
            onPress={() => router.push({ pathname: '/mini/[appId]', params: { appId: app.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${app.name}`}
            style={({ pressed }) => [styles.app, pressed && { opacity: 0.7 }]}>
            <View>
              <Image source={{ uri: miniAppIcon(app) }} style={styles.appIcon} contentFit="cover" />
              <ChainBadge chain={app.chain} />
            </View>
            <Text variant="label" numberOfLines={1}>
              {app.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text variant="overline" color="textSecondary">
        Atlas
      </Text>
      <View style={styles.grid}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.title}
            disabled={!item.href}
            onPress={() => item.href && router.push(item.href)}
            style={({ pressed }) => [styles.cell, pressed && { backgroundColor: colors.bgSurfaceAlt }]}>
            <View style={styles.cellTop}>
              <IconTile icon={item.icon} tone={item.tone} size={48} />
              {item.href ? null : <SoonChip />}
            </View>
            <Text variant="bodyStrong">{item.title}</Text>
            <Text variant="caption" color="textSecondary">
              {item.subtitle}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  apps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  app: {
    width: '25%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  appIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceLight,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cell: {
    width: '47.5%',
    flexGrow: 1,
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.bgSurface,
  },
  cellTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
});
