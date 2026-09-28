import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconTile, SoonChip } from '@/components/ui/icon-tile';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/theme';

// Send hub with MiniPay's three ways out. The flows behind each card land in Phase 4.
export default function SendScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Send to</Text>
        <Icon name="search" size={24} color="textPrimary" />
      </View>

      <SendOption
        tile={<IconTile icon="paper-plane-outline" />}
        title="Atlas Friends"
        subtitle="Instant & free"
      />
      <SendOption
        tile={
          <View style={styles.cluster}>
            <ClusterIcon icon="business-outline" bg={colors.tileBlue} ink="tileBlueInk" />
            <ClusterIcon icon="phone-portrait-outline" bg={colors.tilePink} ink="tilePinkInk" offset />
            <ClusterIcon icon="card-outline" bg={colors.surfaceLight} ink="textOnLight" offset />
          </View>
        }
        title="Banks & Mobile Money"
        subtitle="Straight to your bank or wallet"
      />
      <SendOption tile={<IconTile icon="logo-usd" tone="blue" />} title="Cash Link" subtitle="Just share a link with text" />
    </Screen>
  );
}

function SendOption({ tile, title, subtitle }: { tile: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Card style={styles.option}>
      <View style={styles.optionTop}>
        {tile}
        <SoonChip />
      </View>
      <View style={styles.optionText}>
        <Text variant="heading">{title}</Text>
        <Text color="textSecondary">{subtitle}</Text>
      </View>
    </Card>
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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
});
