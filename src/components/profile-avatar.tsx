import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radii, themedStyles } from '@/theme';

// The user's profile photo, or their initial on Atlas pink when they haven't set one.
export function ProfileAvatar({ photo, initial, size }: { photo?: string | null; initial: string; size: number }) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (photo) {
    return <Image source={{ uri: photo }} style={round} contentFit="cover" accessibilityLabel="Your profile photo" />;
  }
  return (
    <View style={[styles.fallback, round]}>
      <Text variant={size >= 64 ? 'title' : 'heading'} color="accentPinkTint">
        {initial}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  fallback: {
    backgroundColor: colors.accentPinkDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
}));
