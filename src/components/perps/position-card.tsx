import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Line, LinearGradient, Pattern, Polygon, Rect, Stop } from 'react-native-svg';

import type { PerpPosition } from '@/api/contract';
import { LiquidationPrice } from '@/components/perps/liquidation-price';
import { useShareImage } from '@/components/share/use-share-image';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { heldFor } from '@/format/duration';
import { formatMoney, formatPrice } from '@/format/money';
import { colors, fonts, spacing } from '@/theme';

// Drawn on a fixed 360×240 canvas and scaled to the card's width, so it looks (and exports) the same
// on every screen.
const W = 360;
const H = 240;
// The art panel's diagonal edge: top x, bottom x.
const SPLIT_TOP = 150;
const SPLIT_BOTTOM = 114;
const ART = `0,0 ${SPLIT_TOP},0 ${SPLIT_BOTTOM},${H} 0,${H}`;
// Centre and radius of the logo in the art panel.
const LOGO_X = 66;
const LOGO_R = 38;

// An open position: a share card kept to the few numbers worth bragging about, with the
// liquidation price right under it in the app (it's not something people post, but it must
// never be hidden from the owner).
export function PositionCard({ position: p, handle }: { position: PerpPosition; handle: string | null }) {
  const card = useRef<View>(null);
  const [scale, setScale] = useState(1);
  const { share, sharing, shareError } = useShareImage(card, W / H, `atlas-${p.symbol.toLowerCase()}-${p.side}.png`, 'Share position');

  const up = Number(p.unrealizedPnl.amount) >= 0;
  // Venues don't always report PnL % or margin; fall back to numbers they do report.
  const pct = p.unrealizedPnlPct === null ? null : Number(p.unrealizedPnlPct);
  const pnlText = `${up ? '+' : ''}${formatMoney(p.unrealizedPnl)}`;
  const gain = up ? 'success' : 'danger';
  const s = (n: number) => n * scale;
  const onLayout = (e: LayoutChangeEvent) => setScale(e.nativeEvent.layout.width / W);

  const t = (size: number, lineHeight = size * 1.25) => ({ fontSize: s(size), lineHeight: s(lineHeight) });

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
            <AssetAvatar symbol={p.symbol} iconUrl={p.iconUrl ?? null} size={s(LOGO_R * 2 - 6)} />
          </View>
        </View>

        {/* Right panel: headline up top, two numbers in the middle, invite and brand at the bottom. */}
        <View style={[styles.data, { left: s(SPLIT_TOP + 8), paddingRight: s(18), paddingVertical: s(16) }]}>
          <View style={styles.right}>
            <Text style={[styles.headline, t(18)]} numberOfLines={1}>
              {p.symbol}-PERP
            </Text>
            <Text color={gain} style={[styles.headline, t(44, 50)]} numberOfLines={1} adjustsFontSizeToFit>
              {pct === null ? pnlText : `${up ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`}
            </Text>
            <View style={[styles.meta, { gap: s(5) }]}>
              <Text color="textSecondary" style={[styles.caps, t(10.5)]}>
                {p.leverage}× {p.side === 'long' ? 'LONG' : 'SHORT'} · {heldFor(p.openedAtUnixMs)}
              </Text>
              <Icon name="time-outline" size={s(12)} color="textSecondary" />
            </View>
          </View>

          <View style={styles.columns}>
            <View>
              <Text color="textSecondary" style={[styles.caps, t(9.5)]}>
                {p.margin ? 'INVESTED' : 'ENTRY'}
              </Text>
              <Text style={[styles.headline, t(17, 21)]} numberOfLines={1} adjustsFontSizeToFit>
                {p.margin ? formatMoney(p.margin) : formatPrice(p.entryPrice)}
              </Text>
            </View>
            <View style={styles.right}>
              <Text color="textSecondary" style={[styles.caps, t(9.5)]}>
                {pct === null ? 'NOW' : 'GAIN/LOSS'}
              </Text>
              <Text color={pct === null ? 'textPrimary' : gain} style={[styles.headline, t(17, 21)]} numberOfLines={1} adjustsFontSizeToFit>
                {pct === null ? formatPrice(p.markPrice) : pnlText}
              </Text>
            </View>
          </View>

          <View style={[styles.footer, { gap: s(12) }]}>
            {handle ? (
              <View>
                <Text color="textSecondary" style={[styles.caps, t(8.5)]}>
                  INVITE CODE
                </Text>
                <Text style={[styles.headline, t(12, 15)]}>{handle.toUpperCase()}</Text>
              </View>
            ) : null}
            <Text color="accentPink" style={[styles.headline, t(24, 26)]}>
              atlas
            </Text>
          </View>
        </View>
      </View>

      <LiquidationPrice price={p.liquidationPrice} side={p.side} symbol={p.symbol} compact />

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
    justifyContent: 'space-between',
  },
  right: {
    alignItems: 'flex-end',
  },
  // No colour here: the Text `color` prop decides (a style colour would override green/red).
  headline: {
    fontFamily: fonts.display,
    letterSpacing: -0.5,
  },
  caps: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  columns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
