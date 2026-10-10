import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useState } from 'react';
import { useAssetDetail } from '@/api/asset-detail';
import { useAtlasAuth } from '@/auth/context';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { AssetShare } from '@/components/trade/asset-share';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatPrice } from '@/format/money';
import { useSettings } from '@/settings/context';
import { colors, radii, spacing, themedStyles } from '@/theme';

export default function SharedAssetScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  const { displayCurrency } = useSettings();
  const { authenticated } = useAtlasAuth();
  const { asset, error } = useAssetDetail(assetId, displayCurrency);
  const [shareOpen, setShareOpen] = useState(false);
  return <Screen>
    <View style={styles.wrap}>
      <View style={styles.header}><Text variant="overline" color="accentPink">EXPLORE ON ATLAS</Text>
        {asset ? <Pressable onPress={() => setShareOpen(true)} accessibilityRole="button" accessibilityLabel="Share asset" style={styles.action}>
          <Icon name="share-social-outline" size={21} color="accentPink" />
        </Pressable> : null}
      </View>
      {asset ? <>
        <AssetAvatar symbol={asset.symbol} iconUrl={asset.iconUrl} size={76} />
        <Text variant="display">{asset.name}</Text>
        <Text color="textSecondary">{asset.symbol}{asset.chain ? ' · ' + asset.chain : ''}</Text>
        <Text variant="display">{formatPrice(asset.price)}</Text>
        <Text color="textSecondary">One balance for stocks, memes and crypto. Explore this asset and more on Atlas.</Text>
        {asset.verified === false ? <Text color="danger" variant="caption">Unverified token. Check its contract before trading.</Text> : null}
        <PillButton label={authenticated ? 'Open asset' : 'Join Atlas'} onPress={() => {
          if (!authenticated) { router.push('/sign-in'); return; }
          router.push({ pathname: '/trade/[assetId]', params: { assetId: asset.assetId, symbol: asset.symbol,
            name: asset.name, price: asset.price.amount, iconUrl: asset.iconUrl ?? '', change: asset.change24hPct ?? '',
            verified: asset.verified === false ? 'no' : 'yes', tradeable: asset.tradeable === false ? 'no' : 'yes', kind: asset.kind } });
        }} />
        <AssetShare asset={asset} visible={shareOpen} onClose={() => setShareOpen(false)} />
      </> : error ? <Text color="danger">{error}</Text> : <ActivityIndicator color={colors.accentPink} />}
    </View>
  </Screen>;
}
const styles = themedStyles(() => ({
  wrap: { padding: spacing.xl, gap: spacing.lg, width: '100%', maxWidth: 600, alignSelf: 'center',
    backgroundColor: colors.bgSurface, borderRadius: radii.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  action: { padding: spacing.sm, backgroundColor: colors.accentPinkDim, borderRadius: radii.pill },
}));
