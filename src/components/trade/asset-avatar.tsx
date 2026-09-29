import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { bundledLogo } from '@/components/trade/asset-logos';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme';

// The engine's icon if it sends one, else the bundled logo, else the symbol's initials.
export function AssetAvatar({ symbol, iconUrl, size = 44 }: { symbol: string; iconUrl: string | null; size?: number }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  const source = iconUrl ? { uri: iconUrl } : bundledLogo(symbol);
  if (source) {
    return <Image source={source} style={[styles.base, style]} contentFit="cover" accessibilityLabel={`${symbol} logo`} />;
  }
  return (
    <View style={[styles.base, styles.fallback, style]}>
      <Text variant="label" color="tilePinkInk" style={{ fontSize: size * 0.26 }} numberOfLines={1}>
        {symbol.slice(0, 4)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: colors.tilePink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
