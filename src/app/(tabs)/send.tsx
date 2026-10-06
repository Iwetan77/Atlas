import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing, themedStyles } from '@/theme';
import { DesktopColumns } from '@/components/web/columns';
import { SpendableCard } from '@/components/send/spendable-card';

// Send hub on the website (the phone uses Home's Send sheet): four ways out of the one balance.
export default function SendScreen() {
  return (
    <Screen>
      <Text variant="title" style={styles.header}>
        Send to
      </Text>
      <SpendableCard />

      <DesktopColumns>
      <SendOption
        href="/send/bank"
        tile={
          <View style={styles.cluster}>
            <ClusterIcon icon="business-outline" bg={colors.tileBlue} ink="tileBlueInk" />
            <ClusterIcon icon="phone-portrait-outline" bg={colors.tilePink} ink="tilePinkInk" offset />
            <ClusterIcon icon="card-outline" bg={colors.tileNeutral} ink="textOnLight" offset />
          </View>
        }
        title="Banks & Mobile Money"
        subtitle="Straight to your bank or wallet"
      />
      <SendOption
        href="/send/friend"
        tile={<IconTile icon="paper-plane-outline" />}
        title="Atlas Friends"
        subtitle="Instant & free"
      />
      <SendOption
        href="/send/link"
        tile={<IconTile icon="logo-usd" tone="blue" />}
        title="Atlas Link"
        subtitle="Just share a link with text"
      />
      <SendOption
        href="/send/wallet"
        tile={<IconTile icon="wallet-outline" />}
        title="Withdraw to wallet"
        subtitle="USDC, USDT, SOL, BTC and more"
      />
      </DesktopColumns>
    </Screen>
  );
}

function SendOption({ href, tile, title, subtitle }: { href: Href; tile: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Pressable onPress={() => router.push(href)} accessibilityRole="button" accessibilityLabel={title}>
      {({ pressed }) => (
        <Card style={[styles.option, pressed && { backgroundColor: colors.bgSurfaceAlt }]}>
          <View style={styles.optionTop}>
            {tile}
            <Icon name="chevron-forward" size={20} color="textSecondary" />
          </View>
          <View style={styles.optionText}>
            <Text variant="heading">{title}</Text>
            <Text color="textSecondary">{subtitle}</Text>
          </View>
        </Card>
      )}
    </Pressable>
  );
}

function ClusterIcon({
  icon,
  bg,
  ink,
  offset,
}: {
  icon: IconName;
  bg: string;
  ink: 'tileBlueInk' | 'tilePinkInk' | 'textOnLight';
  offset?: boolean;
}) {
  return (
    <View style={[styles.clusterIcon, { backgroundColor: bg }, offset && styles.clusterOffset]}>
      <Icon name={icon} size={24} color={ink} />
    </View>
  );
}

const styles = themedStyles(() => ({
  header: {
    marginBottom: spacing.sm,
  },
  option: {
    gap: spacing.lg,
    borderRadius: 28,
    paddingVertical: spacing.xxl,
  },
  optionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  optionText: {
    gap: spacing.xxs,
  },
  cluster: {
    flexDirection: 'row',
  },
  clusterIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterOffset: {
    marginLeft: -14,
  },
}));
