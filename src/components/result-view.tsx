import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/theme';

// Full-screen outcome of a money action: what happened, in one line, and where to go next.
export function ResultView({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <Screen style={styles.center}>
      <View style={styles.icon}>
        <Icon name="checkmark" size={38} color="bgDeep" />
      </View>
      <Text variant="title" style={styles.text}>
        {title}
      </Text>
      {subtitle ? (
        <Text color="textSecondary" style={styles.text}>
          {subtitle}
        </Text>
      ) : null}
      <View style={styles.actions}>{children}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
