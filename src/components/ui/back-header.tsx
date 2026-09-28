import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';

export function BackHeader({ title }: { title?: string }) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        <Text variant="title" color="accentPink">
          ‹
        </Text>
      </Pressable>
      {title ? <Text variant="heading">{title}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
