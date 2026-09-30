import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { MINI_APPS, miniAppIcon } from '@/components/mini-apps/catalog';
import { type IconName } from '@/components/ui/icon';
import { IconTile, SoonChip } from '@/components/ui/icon-tile';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

type Item = { title: string; subtitle: string; icon: IconName; tone: 'pink' | 'blue'; href?: Href };

const ITEMS: Item[] = [
  { title: 'Earn', subtitle: 'Savings that pay', icon: 'leaf-outline', tone: 'pink', href: '/earn' },
  { title: 'Deposit', subtitle: 'From a wallet or exchange', icon: 'arrow-down', tone: 'blue', href: '/deposit' },
  { title: 'Profile', subtitle: 'Settings & currency', icon: 'person-outline', tone: 'pink', href: '/profile' },
];

export default function MoreScreen() {
  return (
    <Screen>
      <Text variant="title">More</Text>

      <Text variant="overline" color="textSecondary">
        Mini apps
      </Text>
      <Text variant="caption" color="textSecondary">
        Apps on Base that open inside Atlas with your wallet connected. You approve every signature.
      </Text>
      <View style={styles.apps}>
        {MINI_APPS.map((app) => (
          <Pressable
            key={app.id}
            onPress={() => router.push({ pathname: '/mini/[appId]', params: { appId: app.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${app.name}`}
            style={({ pressed }) => [styles.app, pressed && { opacity: 0.7 }]}>
            <Image source={{ uri: miniAppIcon(app) }} style={styles.appIcon} contentFit="cover" />
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
