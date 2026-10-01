import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AssetAvatar } from '@/components/trade/asset-avatar';
import { colors } from '@/theme';

// Chains whose logos ship with the app, so the badge never waits on the network.
const BUNDLED_CHAINS: Record<string, number> = {
  base: require('@/assets/chains/base.png'),
  solana: require('@/assets/chains/solana.png'),
  hyperliquid: require('@/assets/chains/hyperliquid.png'),
};

// A coin's logo with the chain it lives on as a small badge in the corner (USDC with Base's logo),
// so the network is unmistakable wherever money comes in. `chain` uses a bundled logo; otherwise
// `chainIconUrl`.
export function TokenChainLogo({
  symbol,
  iconUrl,
  chain,
  chainIconUrl,
  size = 36,
}: {
  symbol: string;
  iconUrl: string | null;
  chain?: string;
  chainIconUrl?: string | null;
  size?: number;
}) {
  const badge = Math.round(size * 0.45);
  const chainIcon = (chain && BUNDLED_CHAINS[chain]) || (chainIconUrl ? { uri: chainIconUrl } : null);
  return (
    <View style={{ width: size, height: size }}>
      <AssetAvatar symbol={symbol} iconUrl={iconUrl} size={size} />
      {chainIcon ? (
        <View style={[styles.badge, { width: badge + 4, height: badge + 4, borderRadius: (badge + 4) / 2 }]}>
          <Image source={chainIcon} style={{ width: badge, height: badge, borderRadius: badge / 2 }} contentFit="cover" />
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
