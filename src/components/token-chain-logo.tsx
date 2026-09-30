import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AssetAvatar } from '@/components/trade/asset-avatar';
import { colors } from '@/theme';

// A coin's logo with the chain it lives on as a small badge in the corner (USDC with Base's logo),
// so the network is unmistakable wherever money comes in.
export function TokenChainLogo({
  symbol,
  iconUrl,
  chainIconUrl,
  size = 36,
}: {
  symbol: string;
  iconUrl: string | null;
  chainIconUrl?: string | null;
  size?: number;
}) {
  const badge = Math.round(size * 0.45);
  return (
    <View style={{ width: size, height: size }}>
      <AssetAvatar symbol={symbol} iconUrl={iconUrl} size={size} />
      {chainIconUrl ? (
        <View style={[styles.badge, { width: badge + 4, height: badge + 4, borderRadius: (badge + 4) / 2 }]}>
          <Image source={{ uri: chainIconUrl }} style={{ width: badge, height: badge, borderRadius: badge / 2 }} contentFit="cover" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSurface,
  },
});
