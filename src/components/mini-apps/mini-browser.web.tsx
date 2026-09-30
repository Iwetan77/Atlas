// On the web a page can't inject a wallet into another site, so a mini app opens in its own tab
// and the user connects there however that site allows.
import { StyleSheet, View } from 'react-native';

import type { MiniApp } from '@/components/mini-apps/catalog';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';

export function MiniBrowser({ app }: { app: MiniApp }) {
  return (
    <Screen>
      <BackHeader title={app.name} />
      <Card style={styles.card}>
        <Text variant="heading">{app.blurb}</Text>
        <Text color="textSecondary">
          Mini apps open inside the Atlas phone app with your wallet already connected. In a browser, {app.name}
          opens in a new tab instead.
        </Text>
        <View style={styles.actions}>
          <PillButton label={`Open ${app.origin}`} icon="open-outline" onPress={() => window.open(app.url, '_blank', 'noopener')} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
});
