import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Modal, Platform, Pressable, Share, View } from 'react-native';
import type { MarketAsset } from '@/api/contract';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { webUrl } from '@/config';
import { formatPrice } from '@/format/money';
import { colors, radii, spacing, themedStyles } from '@/theme';

export function assetShareUrl(assetId: string) {
  return webUrl.replace(/\/$/, '') + '/asset/' + encodeURIComponent(assetId);
}
export function assetCaption(asset: MarketAsset) {
  return `${asset.name} (${asset.symbol}) is trading on Atlas for ${formatPrice(asset.price)}. Explore it on Atlas.`;
}
export function AssetShare({ asset, visible, onClose }: { asset: MarketAsset; visible: boolean; onClose: () => void }) {
  const [notice, setNotice] = useState<string | null>(null);
  const caption = assetCaption(asset);
  const url = assetShareUrl(asset.assetId);
  const message = caption + '\n' + url;
  const copy = async () => {
    try { await Clipboard.setStringAsync(message); setNotice('Caption and link copied'); }
    catch { setNotice('Copy failed. Please try again.'); }
  };
  const share = () => {
    setNotice(null);
    // Preserve the user's tap for Safari. No fetch or image capture before navigator.share.
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        void navigator.share({ title: asset.name + ' on Atlas', text: caption, url }).catch((e: unknown) => {
          if (!(e instanceof Error && e.name === 'AbortError')) setNotice('Choose a social app below or copy the link.');
        });
      } else { void copy(); }
    } else {
      void Share.share({ title: asset.name + ' on Atlas', message, ...(Platform.OS === 'ios' ? { url } : {}) })
        .catch(() => setNotice('Choose a social app below or copy the link.'));
    }
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close share options">
      <Pressable style={styles.sheet} onPress={() => {}}>
        <View style={styles.header}><Text variant="heading">Share this asset</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close" accessibilityRole="button">
            <Icon name="close" size={22} color="textSecondary" />
          </Pressable>
        </View>
        <View style={styles.card}>
          <View style={styles.asset}><AssetAvatar symbol={asset.symbol} iconUrl={asset.iconUrl} size={44} />
            <View style={styles.flex}><Text variant="heading">{asset.name}</Text><Text color="textSecondary">{asset.symbol}</Text></View>
          </View>
          <Text variant="display" adjustsFontSizeToFit numberOfLines={1}>{formatPrice(asset.price)}</Text>
          <Text variant="caption" color="textSecondary">Trading on Atlas · Price at time of sharing</Text>
        </View>
        <Text>{caption}</Text>
        <PillButton label="Share to apps" icon="share-social-outline" onPress={share} />
        <View style={styles.social}>
          <PillButton label="WhatsApp" tone="secondary" size="sm" style={styles.flex}
            onPress={() => void Linking.openURL('https://wa.me/?text=' + encodeURIComponent(message))} />
          <PillButton label="X" tone="secondary" size="sm" style={styles.flex}
            onPress={() => void Linking.openURL('https://twitter.com/intent/tweet?text=' + encodeURIComponent(caption) + '&url=' + encodeURIComponent(url))} />
        </View>
        <PillButton label="Copy caption & link" icon="copy-outline" tone="secondary" onPress={() => void copy()} />
        {notice ? <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">{notice}</Text> : null}
      </Pressable>
    </Pressable>
  </Modal>;
}
const styles = themedStyles(() => ({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: spacing.lg },
  sheet: { width: '100%', maxWidth: 440, alignSelf: 'center', borderRadius: radii.lg,
    backgroundColor: colors.bgSurface, padding: spacing.xl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  card: { backgroundColor: colors.bgBase, borderRadius: radii.md, padding: spacing.lg, gap: spacing.md,
    borderWidth: 1, borderColor: colors.border },
  asset: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  social: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
}));
