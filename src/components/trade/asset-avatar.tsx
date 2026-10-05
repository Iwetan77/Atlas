import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { bundledLogo } from '@/components/trade/asset-logos';
import { Text } from '@/components/ui/text';
import { colors, themedStyles } from '@/theme';

// The engine's icon if it sends one (and it loads), else the bundled logo, else the symbol's initials.
// Never blank: a logo that fails to load (a dev build fetches even bundled ones) falls back too.
export function AssetAvatar({ symbol, iconUrl, size = 44 }: { symbol: string; iconUrl: string | null; size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [bundledFailed, setBundledFailed] = useState(false);
  const style = { width: size, height: size, borderRadius: size / 2 };
  const remote = iconUrl && iconUrl !== failedUrl ? { uri: iconUrl } : null;
  const source = remote ?? (bundledFailed ? null : bundledLogo(symbol));
  if (source) {
    return (
      <Image
        source={source}
        style={[styles.base, style]}
        contentFit="cover"
        accessibilityLabel={`${symbol} logo`}
        onError={() => (remote && iconUrl ? setFailedUrl(iconUrl) : setBundledFailed(true))}
      />
    );
  }
  return (
    <View style={[styles.base, styles.fallback, style]}>
      <Text variant="label" color="tilePinkInk" style={{ fontSize: size * 0.26 }} numberOfLines={1}>
        {symbol.slice(0, 4)}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  base: {
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: colors.tilePink,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
