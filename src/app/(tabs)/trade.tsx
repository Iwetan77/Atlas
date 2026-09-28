import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { IconTile, SoonChip } from '@/components/ui/icon-tile';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

// Stocks, memes and crypto share one screen and one buy flow; chips only filter.
const CATEGORIES = ['Popular', 'Stocks', 'Memes', 'Crypto'] as const;

// Layout for Phase 3. Search and the market list go live when the engine's quote endpoint does.
export default function TradeScreen() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Popular');

  return (
    <Screen>
      <Text variant="title">Trade</Text>
      <Field prefix={<Icon name="search" size={20} color="textSecondary" />} placeholder="Search anything" editable={false} />
      <View style={styles.chips}>
        {CATEGORIES.map((c) => {
          const active = c === category;
          return (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.chip, { backgroundColor: active ? colors.accentPink : colors.bgSurface }]}>
              <Text variant="label" color={active ? 'textOnAccent' : 'textSecondary'}>
                {c}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.empty}>
        <View style={styles.emptyTop}>
          <IconTile icon="trending-up" />
          <SoonChip />
        </View>
        <Text variant="heading">Markets open in the next build</Text>
        <Text color="textSecondary">
          Tokenized stocks, memecoins and crypto, priced in your currency, bought from your one balance with one tap.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  empty: {
    gap: spacing.md,
  },
  emptyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
});
