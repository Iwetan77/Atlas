import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { colors, spacing, themedStyles } from '@/theme';

const SLOW_MS = 12_000;

// A contained connection status while the saved session restores.
export function StartupStatus({ error }: { error: string | null }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <View testID="atlas-startup-status" style={styles.wrap}>
      <Text variant="bodyStrong">Connecting to Atlas</Text>
      {error ? null : <ActivityIndicator color={colors.accentPink} />}
      {error || slow ? (
        <View style={styles.detail}>
          <Text variant="bodyStrong" style={styles.center}>
            {error ? "Couldn't start sign-in" : 'Taking longer than usual…'}
          </Text>
          <Text variant="caption" color="textSecondary" style={styles.center}>
            {error ?? 'Still connecting to the sign-in service. Check your internet connection.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Root error screen: shows the real message so a crash on a phone is reportable, with a retry.
export function StartupError({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={styles.wrap}>
      <Text variant="title" color="accentPink">
        atlas
      </Text>
      <View style={styles.detail}>
        <Text variant="bodyStrong" style={styles.center}>
          Something went wrong
        </Text>
        <Text variant="caption" color="textSecondary" selectable style={styles.center}>
          {error.message}
        </Text>
      </View>
      <PillButton label="Try again" onPress={retry} />
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: {
    flex: 1,
    minHeight: 240,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
    backgroundColor: colors.bgBase,
  },
  detail: {
    gap: spacing.sm,
    maxWidth: 360,
  },
  center: {
    textAlign: 'center',
  },
}));
