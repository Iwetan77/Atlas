import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { enginePost } from '@/api/client';
import type { MarketAsset } from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { webUrl } from '@/config';
import { formatPrice } from '@/format/money';
import { colors, darkColors, fonts, PaletteContext, radii, spacing, themedStyles } from '@/theme';

export type ShareAsset = MarketAsset & { shareUrl?: string; shareCode?: string };
export function assetShareUrl(assetId: string) {
  return webUrl.replace(/\/$/, '') + '/asset/' + encodeURIComponent(assetId);
}
export function assetCaption(asset: MarketAsset) {
  return `Trade ${asset.symbol} on Atlas. ${asset.name} is trading at ${formatPrice(asset.price)}.\nClick the link below to explore and trade.`;
}
export function AssetShare({ asset, visible, onClose }: { asset: ShareAsset; visible: boolean; onClose: () => void }) {
  const { authenticated, getAccessToken } = useAtlasAuth();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<{ key: string; url: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [retry, setRetry] = useState(0);
  const key = asset.assetId + ':' + asset.price.currency;
  useEffect(() => {
    if (!visible) return;
    let live = true;
    void Promise.resolve().then(async () => {
      if (!live) return;
      setNotice(null);
      // A public short-link landing already carries its verified server alias.
      if (asset.shareCode && /^[A-Za-z0-9_-]{8}$/.test(asset.shareCode)) {
        setPrepared({ key, url: webUrl.replace(/\/$/, '') + '/a/' + asset.shareCode });
        setPreparing(false);
        return;
      }
      if (!authenticated) {
        setPrepared({ key, url: assetShareUrl(asset.assetId) });
        setPreparing(false);
        return;
      }
      setPreparing(true);
      try {
        const result = await enginePost<{ code: string; url: string }>(
          '/v1/asset-shares', await getAccessToken(), { assetId: asset.assetId, currency: asset.price.currency }, { timeoutMs: 15_000 });
        if (!/^[A-Za-z0-9_-]{8}$/.test(result.code)) throw new Error('Could not prepare this asset link.');
        if (live) setPrepared({ key, url: webUrl.replace(/\/$/, '') + '/a/' + result.code });
      } catch (e) { if (live) setNotice(errorMessage(e)); }
      finally { if (live) setPreparing(false); }
    });
    return () => { live = false; };
  }, [asset.assetId, asset.price.currency, asset.shareCode, authenticated, getAccessToken, key, retry, visible]);
  const caption = assetCaption(asset);
  const url = prepared?.key === key ? prepared.url : null;
  const message = caption + '\n' + (url ?? '');
  const copy = async () => {
    if (!url) return;
    try { await Clipboard.setStringAsync(message); setNotice('Caption and short link copied'); }
    catch { setNotice('Copy failed. Please try again.'); }
  };
  const share = () => {
    if (!url) return;
    setNotice(null);
    // Link preparation happens before this tap, preserving Safari's share gesture.
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        void navigator.share({ title: 'Trade ' + asset.symbol + ' on Atlas', text: caption, url }).catch((e: unknown) => {
          if (!(e instanceof Error && e.name === 'AbortError')) setNotice('Choose an app below or copy the link.');
        });
      } else { void copy(); }
    } else {
      void Share.share({ title: 'Trade ' + asset.symbol + ' on Atlas', message,
        ...(Platform.OS === 'ios' ? { url } : {}) }).catch(() => setNotice('Choose an app below or copy the link.'));
    }
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, spacing.lg), paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}><View style={styles.flex}>
            <Text variant="heading">Share {asset.symbol}</Text>
            <Text variant="caption" color="textSecondary">Your next move, worth sharing.</Text>
          </View><Pressable onPress={onClose} accessibilityLabel="Close share options" accessibilityRole="button" style={styles.close}>
            <Icon name="close" size={22} color="textSecondary" />
          </Pressable></View>
          <PaletteContext.Provider value={darkColors}>
            <LinearGradient colors={[darkColors.bgDeep, '#251925', '#191C26']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
              <View style={styles.cardBrand}><Text variant="heading" color="accentPinkTint">atlas.</Text>
                <Text variant="overline" color="textSecondary">YOUR NEXT MOVE</Text></View>
              <View style={styles.asset}><AssetAvatar symbol={asset.symbol} iconUrl={asset.iconUrl} size={52} />
                <View style={styles.flex}><Text variant="heading" numberOfLines={2}>{asset.name}</Text>
                  <Text variant="caption" color="textSecondary">{asset.symbol}</Text></View>
              </View>
              <View style={styles.cardHeadline}><Text variant="title" numberOfLines={2}>Trade {asset.symbol} on Atlas</Text>
                <Text style={styles.price} color="accentPinkTint" numberOfLines={1} adjustsFontSizeToFit>{formatPrice(asset.price)}</Text>
                <Text variant="caption" color="textSecondary">Price at time of sharing</Text></View>
              <View style={styles.cardFooter}>
                <Text variant="caption" color="textSecondary">Click the link below to explore and trade</Text>
                <Text variant="label" numberOfLines={1}>{url ? url.replace(/^https?:\/\//, '') : 'Preparing your short link…'}</Text>
              </View>
            </LinearGradient>
          </PaletteContext.Provider>
          <PillButton label="Share to apps" icon="share-social-outline" disabled={!url} loading={preparing && !url} onPress={share} />
          <View style={styles.social}>
            <Pressable style={styles.socialButton} accessibilityRole="button" accessibilityLabel="Share on WhatsApp" disabled={!url}
              onPress={() => void Linking.openURL('https://wa.me/?text=' + encodeURIComponent(message))}>
              <Icon name="logo-whatsapp" size={22} /><Text variant="label">WhatsApp</Text>
            </Pressable>
            <Pressable style={styles.socialButton} accessibilityRole="button" accessibilityLabel="Share on X" disabled={!url}
              onPress={() => void Linking.openURL('https://twitter.com/intent/tweet?text=' + encodeURIComponent(caption) + '&url=' + encodeURIComponent(url ?? ''))}>
              <Text style={styles.xLogo}>𝕏</Text><Text variant="label">Post on X</Text>
            </Pressable>
            <Pressable style={styles.socialButton} accessibilityRole="button" accessibilityLabel="Copy caption and link" disabled={!url} onPress={() => void copy()}>
              <Icon name="copy-outline" size={21} /><Text variant="label">Copy link</Text>
            </Pressable>
          </View>
          {notice ? <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">{notice}</Text> : null}
          {!url && !preparing && notice ? <PillButton label="Try again" tone="secondary" size="sm" onPress={() => setRetry(n => n + 1)} /> : null}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const styles = themedStyles(() => ({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: spacing.lg },
  sheet: { width: '100%', maxWidth: 440, maxHeight: '100%', alignSelf: 'center', borderRadius: radii.lg, backgroundColor: colors.bgSurface, overflow: 'hidden' },
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  card: { borderRadius: radii.md, padding: spacing.lg, gap: spacing.lg, overflow: 'hidden' },
  cardBrand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  asset: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardHeadline: { gap: spacing.sm },
  price: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  cardFooter: { borderTopWidth: 1, borderTopColor: darkColors.border, paddingTop: spacing.md, gap: spacing.xs },
  social: { flexDirection: 'row', gap: spacing.sm },
  socialButton: { flex: 1, minHeight: 72, backgroundColor: colors.bgBase, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm },
  xLogo: { fontSize: 23, lineHeight: 26 },
  flex: { flex: 1 },
}));
