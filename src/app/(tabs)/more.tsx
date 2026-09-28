import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { type IconName } from '@/components/ui/icon';
import { IconTile, SoonChip } from '@/components/ui/icon-tile';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { showDevTools } from '@/config';
import { colors, radii, spacing } from '@/theme';

type Item = { title: string; subtitle: string; icon: IconName; tone: 'pink' | 'blue'; href?: Href };

const ITEMS: Item[] = [
  { title: 'Earn', subtitle: 'Grow your money', icon: 'leaf-outline', tone: 'pink' },
  { title: 'Perps', subtitle: 'Long or short', icon: 'pulse-outline', tone: 'blue' },
  { title: 'Deposit', subtitle: 'Naira or crypto', icon: 'arrow-down', tone: 'blue', href: '/deposit' },
  { title: 'Profile', subtitle: 'Settings & currency', icon: 'person-outline', tone: 'pink', href: '/profile' },
  ...(showDevTools
    ? [{ title: 'Developer', subtitle: 'Testnet tools', icon: 'construct-outline', tone: 'blue', href: '/dev' } as Item]
    : []),
];

export default function MoreScreen() {
  return (
    <Screen>
      <Text variant="title">More</Text>
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
