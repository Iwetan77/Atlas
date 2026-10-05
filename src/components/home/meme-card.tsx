import { useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Pattern, Polygon, Rect, Stop } from 'react-native-svg';

import type { SpotPosition } from '@/api/contract';
import { useShareImage } from '@/components/share/use-share-image';
import { ShareImageSheet } from '@/components/share/share-image-sheet';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { heldFor } from '@/format/duration';
import { formatMoney, formatPrice, formatSignedMoney, hiddenMoney } from '@/format/money';
import { darkColors as colors, fonts, PaletteContext, spacing, type ColorToken } from '@/theme';

// Same 360×240 canvas as the perps card, scaled to the card's width, so it exports the same everywhere.
const W = 360;
const H = 240;
// The coin's mascot (its logo) sits on a comic starburst on the left and says something.
const LOGO_X = 80;
const LOGO_Y = 140;
const LOGO_R = 46;
const BUBBLE = { x: 14, y: 14, w: 136, h: 36 };
// Where the numbers start, and the width they get.
const DATA_X = 184;
const DATA_W = W - DATA_X - 18;

// Largest headline size that keeps the text on one line (auto-shrink is native-only and doesn't
// apply to the exported image). Space Grotesk Bold figures are about 0.62em wide.
export function fitSize(text: string, max: number, width = DATA_W): number {
  return Math.min(max, width / (Math.max(text.length, 1) * 0.62));
}

type Mood = { tag: string; says: string; up: boolean | null };

// What the mascot says, by mood: short enough for its bubble.
const SAYS = {
  holding: ['gm', 'fresh bag', 'day one', 'wen moon', "let's see", 'locked in'],
  moon: ["we're so back", 'lambo szn', 'send it', 'printing', 'moon mission', 'gg ez', 'called it'],
  pumping: ['wagmi', 'up only', 'number go up', 'lfg', 'cooking', 'green candles', 'early tbh'],
  crabbing: ['just vibing', 'hodl is cool', 'patience pays', 'sideways szn', 'still early', 'comfy', 'zen mode'],
  diamond: ['hodl', 'not selling', 'buy the dip', 'zoom out', 'never selling', 'this is fine', "it's a sale"],
  rekt: ["it's so over", 'ngmi', 'down bad', 'send help', 'pain', 'f in chat', 'rugged?'],
} as const;

// One line per coin, kept as the numbers move within a mood (the symbol picks it).
function pick(lines: readonly string[], seed: string): string {
  let hash = 0;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return lines[hash % lines.length];
}

// Trojan-style: the bigger the move, the louder the card.
export function moodFor(pct: number | null, seed = ''): Mood {
  if (pct === null) return { tag: 'HOLDING', says: pick(SAYS.holding, seed), up: null };
  if (pct >= 100) return { tag: 'TO THE MOON', says: pick(SAYS.moon, seed), up: true };
  if (pct >= 10) return { tag: 'PUMPING', says: pick(SAYS.pumping, seed), up: true };
  if (pct > -10) return { tag: 'CRABBING', says: pick(SAYS.crabbing, seed), up: null };
  if (pct > -50) return { tag: 'DIAMOND HANDS', says: pick(SAYS.diamond, seed), up: false };
  return { tag: 'REKT', says: pick(SAYS.rekt, seed), up: false };
}

// Points of a starburst around (cx, cy).
function burst(cx: number, cy: number, outer: number, inner: number, spikes: number): string {
  const points: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    points.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return points.join(' ');
}

// A four-point sparkle.
function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.28;
  return `${x},${y - r} ${x + k},${y - k} ${x + r},${y} ${x + k},${y + k} ${x},${y + r} ${x - k},${y + k} ${x - r},${y} ${x - k},${y - k}`;
}

// A coin the user holds, as a card worth posting: the coin's own mascot with a mood, the big
// percentage, what went in and what it's worth now. Entry and realised gains sit under it, in the
// app only. It lives on the coin's own screen, kept live there (`onRefresh` asks for fresh numbers).
// The card is a picture people post, so it stays dark in light mode.
export function MemeCard({
  position: p,
  handle,
  stealth,
  onRefresh,
  refreshing,
}: {
  position: SpotPosition;
  handle: string | null;
  stealth: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const card = useRef<View>(null);
  const [scale, setScale] = useState(1);
  const { share, sharing, shareError, menu } = useShareImage(card, W / H, `atlas-${p.symbol.toLowerCase()}.png`, 'Share your bag');

  const pct = p.pnlPct === null ? null : Number(p.pnlPct);
  const mood = moodFor(pct, p.symbol);
  const gain: ColorToken = mood.up === false || Number(p.pnl.amount) < 0 ? 'danger' : 'success';
  const glow = mood.up === null ? colors.accentPink : mood.up ? colors.success : colors.danger;
  const s = (n: number) => n * scale;
  const t = (size: number, lineHeight = size * 1.25) => ({ fontSize: s(size), lineHeight: s(lineHeight) });
  const onLayout = (e: LayoutChangeEvent) => setScale(e.nativeEvent.layout.width / W);
  const money = (m: SpotPosition['value']) => (stealth ? hiddenMoney(m.currency) : formatMoney(m));
  const headline = pct === null ? (stealth ? hiddenMoney(p.pnl.currency) : formatSignedMoney(p.pnl)) : `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`;
  const realized = Number(p.realizedPnl.amount);

  return (
    <View style={styles.wrap}>
      <PaletteContext.Provider value={colors}>
      <View ref={card} collapsable={false} onLayout={onLayout} style={styles.card}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="memeNight" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.bgDeep} />
              <Stop offset="1" stopColor={colors.accentPinkMuted} />
            </LinearGradient>
            <Pattern id="memeDots" width="8" height="8" patternUnits="userSpaceOnUse">
              <Circle cx="2" cy="2" r="1.3" fill={glow} fillOpacity={0.28} />
            </Pattern>
          </Defs>
          <Rect width={W} height={H} fill="url(#memeNight)" />
          <Rect width={172} height={H} fill="url(#memeDots)" />
          <Polygon points={burst(LOGO_X, LOGO_Y, 84, 60, 14)} fill={glow} fillOpacity={0.9} />
          <Polygon points={burst(LOGO_X, LOGO_Y, 66, 52, 14)} fill={colors.bgDeep} fillOpacity={0.35} />
          {/* Speech bubble with its tail pointing at the mascot. */}
          <Rect x={BUBBLE.x} y={BUBBLE.y} width={BUBBLE.w} height={BUBBLE.h} rx={14} fill={colors.surfaceLight} />
          <Polygon points={`${LOGO_X - 6},${BUBBLE.y + BUBBLE.h - 1} ${LOGO_X + 14},${BUBBLE.y + BUBBLE.h - 1} ${LOGO_X + 2},${BUBBLE.y + BUBBLE.h + 14}`} fill={colors.surfaceLight} />
          {mood.up === true
            ? [
                [150, 78, 9],
                [26, 200, 7],
                [146, 214, 6],
                [20, 86, 5],
              ].map(([x, y, r]) => <Polygon key={`${x}-${y}`} points={sparkle(x, y, r)} fill={colors.surfaceLight} />)
            : null}
          {mood.up === false ? (
            // A sweat drop: the classic "this is fine" tell.
            <Path d={`M136 88 C 128 100, 126 108, 136 112 C 146 108, 144 100, 136 88 Z`} fill={colors.tileBlue} />
          ) : null}
        </Svg>

        <View style={[styles.bubble, { left: s(BUBBLE.x), top: s(BUBBLE.y), width: s(BUBBLE.w), height: s(BUBBLE.h) }]}>
          <Text color="textOnLight" style={[styles.headline, t(15, 18)]} numberOfLines={1} adjustsFontSizeToFit>
            {mood.says}
          </Text>
        </View>

        <View
          style={[
            styles.mascot,
            {
              left: s(LOGO_X - LOGO_R),
              top: s(LOGO_Y - LOGO_R),
              width: s(LOGO_R * 2),
              height: s(LOGO_R * 2),
              borderRadius: s(LOGO_R),
              borderWidth: s(4),
            },
          ]}>
          <AssetAvatar symbol={p.symbol} iconUrl={p.iconUrl} size={s(LOGO_R * 2 - 8)} />
        </View>

        <View style={[styles.data, { left: s(DATA_X), paddingRight: s(18), paddingVertical: s(16) }]}>
          <View style={styles.right}>
            <Text style={[styles.headline, t(18)]} numberOfLines={1}>
              ${p.symbol.toUpperCase()}
            </Text>
            <Text color={gain} style={[styles.headline, t(fitSize(headline, 40), 46)]} numberOfLines={1}>
              {headline}
            </Text>
            <Text color="textSecondary" style={[styles.caps, t(10.5)]} numberOfLines={1}>
              {mood.tag} · HELD {heldFor(p.openedAtUnixMs)}
            </Text>
          </View>

          <View style={styles.columns}>
            <View>
              <Text color="textSecondary" style={[styles.caps, t(9.5)]}>
                INVESTED
              </Text>
              <Text style={[styles.headline, t(16, 20)]} numberOfLines={1} adjustsFontSizeToFit>
                {money(p.invested)}
              </Text>
            </View>
            <View style={styles.right}>
              <Text color="textSecondary" style={[styles.caps, t(9.5)]}>
                NOW
              </Text>
              <Text color={gain} style={[styles.headline, t(16, 20)]} numberOfLines={1} adjustsFontSizeToFit>
                {money(p.value)}
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
      </PaletteContext.Provider>

      <View style={styles.facts}>
        <Text variant="caption" color="textSecondary">
          Entry {p.entryPrice ? formatPrice(p.entryPrice) : '—'} · Now {formatPrice(p.price)}
        </Text>
        {realized !== 0 ? (
          <Text variant="caption" color={realized > 0 ? 'success' : 'danger'}>
            {stealth ? hiddenMoney(p.realizedPnl.currency) : formatSignedMoney(p.realizedPnl)} taken
          </Text>
        ) : null}
      </View>
      <ShareImageSheet options={menu} />
      {shareError ? (
        <Text variant="caption" color="danger">
          {shareError}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <PillButton label="Share" icon="share-outline" tone="secondary" size="sm" loading={sharing} onPress={share} style={styles.action} />
        {onRefresh ? (
          <PillButton
            label="Refresh"
            icon="refresh"
            tone="secondary"
            size="sm"
            loading={refreshing}
            onPress={onRefresh}
            style={styles.action}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  card: {
    width: '100%',
    aspectRatio: W / H,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.bgDeep,
  },
  bubble: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  mascot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.surfaceLight,
    backgroundColor: colors.surfaceLight,
    overflow: 'hidden',
    transform: [{ rotate: '-8deg' }],
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
  // No colour here: the Text `color` prop decides.
  headline: {
    fontFamily: fonts.display,
    letterSpacing: -0.5,
  },
  caps: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.8,
  },
  columns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  facts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
