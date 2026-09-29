import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Line, LinearGradient, Pattern, Polygon, Rect, Stop } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import type { PerpPosition } from '@/api/contract';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { formatCompactMoney, formatExactMoney, formatMoney } from '@/format/money';
import { colors, fonts, spacing } from '@/theme';

// Drawn on a fixed 360×240 canvas and scaled to the card's width, so it looks (and exports) the same
// on every screen.
const W = 360;
const H = 240;
// The art panel's diagonal edge: top x, bottom x.
const SPLIT_TOP = 150;
const SPLIT_BOTTOM = 114;
// Centre and radius of the logo in the art panel.
const LOGO_X = 66;
const LOGO_R = 38;
const ART = `0,0 ${SPLIT_TOP},0 ${SPLIT_BOTTOM},${H} 0,${H}`;
// Shared image width in pixels: sharp enough to post.
const EXPORT_W = 1080;

function openFor(openedAtUnixMs: number): string {
  const mins = Math.max(0, Math.floor((Date.now() - openedAtUnixMs) / 60_000));
  if (mins < 60) return `${mins}M`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H ${mins % 60}M`;
  return `${Math.floor(hours / 24)}D`;
}

// An open position as a card worth sharing: art on the left, the numbers on the right, with the
// liquidation price always on it. The card itself is what gets captured and shared.
export function PositionCard({ position: p, handle }: { position: PerpPosition; handle: string | null }) {
  const card = useRef<View>(null);
  const [scale, setScale] = useState(1);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const pnl = Number(p.unrealizedPnl.amount);
  const up = pnl >= 0;
  const gain = up ? 'success' : 'danger';
  const s = (n: number) => n * scale;

  const onLayout = (e: LayoutChangeEvent) => setScale(e.nativeEvent.layout.width / W);

  const share = async () => {
    setSharing(true);
    setShareError(null);
    try {
      if (Platform.OS === 'web') {
        const uri = await captureRef(card, { format: 'png', quality: 1, result: 'data-uri', width: EXPORT_W, height: EXPORT_W / (W / H) });
        const a = document.createElement('a');
        a.href = uri;
        a.download = `atlas-${p.symbol.toLowerCase()}-${p.side}.png`;
        a.click();
      } else {
        const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile', width: EXPORT_W, height: EXPORT_W / (W / H) });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share position' });
      }
    } catch (e) {
      console.warn('[atlas] share card failed', e);
      setShareError("Couldn't create the image. Try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View ref={card} collapsable={false} onLayout={onLayout} style={styles.card}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="night" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.bgDeep} />
              <Stop offset="1" stopColor={colors.accentPinkMuted} />
            </LinearGradient>
            <LinearGradient id="art" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.accentPinkWash} />
              <Stop offset="0.55" stopColor={colors.accentPinkDeep} />
              <Stop offset="1" stopColor={colors.accentPinkMuted} />
            </LinearGradient>
            <Pattern id="dots" width="7" height="7" patternUnits="userSpaceOnUse">
              <Circle cx="2" cy="2" r="1.1" fill={colors.surfaceLight} fillOpacity={0.22} />
            </Pattern>
            <ClipPath id="artClip">
              <Polygon points={ART} />
            </ClipPath>
          </Defs>
          <Rect width={W} height={H} fill="url(#night)" />
          <Polygon points={ART} fill="url(#art)" />
          <Polygon points={ART} fill="url(#dots)" />
          {[52, 80, 110].map((r, i) => (
            <Circle
              key={r}
              cx={LOGO_X}
              cy={H / 2}
              r={r}
              fill="none"
              stroke={colors.surfaceLight}
              strokeOpacity={0.35 - i * 0.09}
              strokeWidth={1.2}
              clipPath="url(#artClip)"
            />
          ))}
          <Line x1={SPLIT_TOP} y1={0} x2={SPLIT_BOTTOM} y2={H} stroke={colors.surfaceLight} strokeWidth={2.5} />
        </Svg>

        <View style={[styles.logo, { left: s(LOGO_X - LOGO_R), top: s(H / 2 - LOGO_R) }]}>
          <View style={[styles.logoRing, { width: s(LOGO_R * 2), height: s(LOGO_R * 2), borderRadius: s(LOGO_R), borderWidth: s(3) }]}>
            <AssetAvatar symbol={p.symbol} iconUrl={null} size={s(LOGO_R * 2 - 6)} />
          </View>
        </View>

        <View style={[styles.data, { left: s(SPLIT_TOP - 6), paddingRight: s(16), paddingTop: s(12), paddingBottom: s(10) }]}>
          <Text style={[styles.pair, { fontSize: s(18), lineHeight: s(22) }]} numberOfLines={1}>
            {p.symbol}-PERP
          </Text>
          <Text
            color={gain}
            style={[styles.percent, { fontSize: s(38), lineHeight: s(44) }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {up ? '+' : '−'}
            {Math.abs(Number(p.unrealizedPnlPct)).toFixed(2)}%
          </Text>
          <View style={[styles.time, { gap: s(6) }]}>
            <View
              style={{
                paddingHorizontal: s(6),
                paddingVertical: s(1.5),
                borderRadius: s(8),
                backgroundColor: p.side === 'long' ? colors.successDim : colors.dangerDim,
              }}>
              <Text color={p.side === 'long' ? 'success' : 'danger'} style={[styles.label, { fontSize: s(9.5), lineHeight: s(12.3) }]}>
                {p.side === 'long' ? 'LONG' : 'SHORT'} {p.leverage}×
              </Text>
            </View>
            <Text style={[styles.label, { fontSize: s(11), lineHeight: s(14.3) }]}>{openFor(p.openedAtUnixMs)}</Text>
            <Icon name="time-outline" size={s(13)} color="textPrimary" />
          </View>

          <View style={[styles.columns, { marginTop: s(8) }]}>
            <View>
              <Text style={[styles.label, { fontSize: s(9.5), lineHeight: s(12.3) }]}>INVESTED</Text>
              <Text style={[styles.value, { fontSize: s(14), lineHeight: s(18) }]} numberOfLines={1}>
                {formatMoney(p.margin)}
              </Text>
              <Text color="textSecondary" style={{ fontSize: s(8.5), lineHeight: s(11.1) }} numberOfLines={1}>
                Entry {formatCompactMoney(p.entryPrice)}
              </Text>
            </View>
            <View style={styles.right}>
              <Text style={[styles.label, { fontSize: s(9.5), lineHeight: s(12.3) }]}>GAIN/LOSS</Text>
              <Text color={gain} style={[styles.value, { fontSize: s(14), lineHeight: s(18) }]} numberOfLines={1}>
                {up ? '+' : ''}
                {formatMoney(p.unrealizedPnl)}
              </Text>
              <Text color="textSecondary" style={{ fontSize: s(8.5), lineHeight: s(11.1) }} numberOfLines={1}>
                Now {formatCompactMoney(p.markPrice)}
              </Text>
            </View>
          </View>

          <View style={[styles.liq, { marginTop: s(6), gap: s(3) }]}>
            <Icon name="warning-outline" size={s(10)} color="danger" />
            <Text color="danger" style={[styles.label, { fontSize: s(8.5), lineHeight: s(11.1) }]}>
              LIQ
            </Text>
            <Text style={{ fontSize: s(9.5), lineHeight: s(12.3), fontFamily: fonts.bodySemi }} numberOfLines={1}>
              {formatExactMoney(p.liquidationPrice)}
            </Text>
          </View>

          <View style={[styles.footer, { right: s(16), bottom: s(10), gap: s(10) }]}>
            <View style={styles.right}>
              <Text color="textSecondary" style={{ fontSize: s(8.5), lineHeight: s(11.1) }}>
                {handle ? 'Join Atlas with my code' : 'One balance, any trade'}
              </Text>
              {handle ? (
                <Text style={[styles.value, { fontSize: s(13), lineHeight: s(16) }]}>{handle.toUpperCase()}</Text>
              ) : null}
            </View>
            <Text color="accentPink" style={[styles.brand, { fontSize: s(22), lineHeight: s(24) }]}>
              atlas
            </Text>
          </View>
        </View>
      </View>

      {shareError ? (
        <Text variant="caption" color="danger">
          {shareError}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <PillButton label="Share" icon="share-outline" tone="secondary" size="sm" loading={sharing} onPress={share} style={styles.action} />
        <PillButton
          label="Close position"
          tone="secondary"
          size="sm"
          style={styles.action}
          onPress={() =>
            router.push({
              pathname: '/perps/close/[positionId]',
              params: { positionId: p.positionId, symbol: p.symbol, side: p.side, leverage: String(p.leverage) },
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  card: {
    width: '100%',
    aspectRatio: W / H,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.bgDeep,
  },
  logo: {
    position: 'absolute',
  },
  logoRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.surfaceLight,
    backgroundColor: colors.surfaceLight,
    overflow: 'hidden',
  },
  data: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'flex-end',
  },
  pair: {
    fontFamily: fonts.display,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  percent: {
    fontFamily: fonts.display,
    letterSpacing: -1,
    textAlign: 'right',
  },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.8,
    color: colors.textPrimary,
  },
  columns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingLeft: spacing.xl,
  },
  value: {
    fontFamily: fonts.display,
    color: colors.textPrimary,
  },
  right: {
    alignItems: 'flex-end',
  },
  liq: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Pinned to the card's corner so the web capture can't reflow it.
  footer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  brand: {
    fontFamily: fonts.display,
    letterSpacing: -0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
