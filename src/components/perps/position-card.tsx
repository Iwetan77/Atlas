import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { PerpPosition } from '@/api/contract';
import { SideBadge } from '@/components/perps/side-badge';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { formatExactMoney, formatMoney, formatPrice } from '@/format/money';
import { colors, radii, spacing } from '@/theme';

const ORBITS = [180, 280, 380];

function openFor(openedAtUnixMs: number): string {
  const mins = Math.max(0, Math.floor((Date.now() - openedAtUnixMs) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

// An open position as a card worth sharing: big PnL, entry → now, the liquidation price (never
// hidden), and the owner's invite code. The card itself is what gets captured and shared.
export function PositionCard({ position: p, handle }: { position: PerpPosition; handle: string | null }) {
  const card = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const pnl = Number(p.unrealizedPnl.amount);
  const up = pnl >= 0;
  const today = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());

  const share = async () => {
    setSharing(true);
    setShareError(null);
    try {
      if (Platform.OS === 'web') {
        const uri = await captureRef(card, { format: 'png', quality: 1, result: 'data-uri' });
        const a = document.createElement('a');
        a.href = uri;
        a.download = `atlas-${p.symbol.toLowerCase()}-${p.side}.png`;
        a.click();
      } else {
        const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
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
      <View ref={card} collapsable={false} style={styles.card}>
        <LinearGradient
          colors={[colors.accentPinkMuted, colors.bgBase, colors.bgDeep]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {ORBITS.map((size, i) => (
          <View
            key={size}
            style={[styles.orbit, { width: size, height: size, borderRadius: size / 2, opacity: 0.45 - i * 0.12 }]}
          />
        ))}
        <View style={styles.watermark}>
          <AssetAvatar symbol={p.symbol} iconUrl={null} size={220} />
        </View>

        <View style={styles.top}>
          <View style={styles.owner}>
            <View style={styles.ownerAvatar}>
              <Text variant="label" color="accentPinkTint">
                {(handle ?? 'A')[0].toUpperCase()}
              </Text>
            </View>
            <View>
              <Text variant="bodyStrong">{handle ? `@${handle}` : 'Atlas trader'}</Text>
              <Text variant="caption" color="textSecondary">
                open · {openFor(p.openedAtUnixMs)}
              </Text>
            </View>
          </View>
          <View style={styles.stamp}>
            <Text variant="caption" color="textSecondary">
              {today}
            </Text>
            <Text variant="label" color="accentPinkTint">
              atlas
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.assetRow}>
            <AssetAvatar symbol={p.symbol} iconUrl={null} size={30} />
            <Text variant="heading">{p.symbol}</Text>
            <SideBadge side={p.side} leverage={p.leverage} />
          </View>
          <View style={styles.pnl}>
            <Text variant="display" color={up ? 'success' : 'danger'} adjustsFontSizeToFit numberOfLines={1}>
              {up ? '+' : ''}
              {formatMoney(p.unrealizedPnl)}
            </Text>
            <Text variant="bodyStrong" color={up ? 'success' : 'danger'}>
              {up ? '▲' : '▼'} {Math.abs(Number(p.unrealizedPnlPct)).toFixed(2)}%
            </Text>
          </View>
          <View style={styles.prices}>
            <Text variant="overline" color="textSecondary">
              Entry
            </Text>
            <Text variant="label">{formatPrice(p.entryPrice)}</Text>
            <Icon name="arrow-forward" size={12} color="textSecondary" />
            <Text variant="overline" color="textSecondary">
              Now
            </Text>
            <Text variant="label">{formatPrice(p.markPrice)}</Text>
          </View>
          <View style={styles.liq} accessibilityLabel={`Liquidation price ${formatExactMoney(p.liquidationPrice)}`}>
            <Icon name="warning-outline" size={14} color="danger" />
            <Text variant="overline" color="danger">
              Liquidation
            </Text>
            <Text variant="bodyStrong" selectable>
              {formatExactMoney(p.liquidationPrice)}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text variant="title" color="accentPink">
            atlas
          </Text>
          <View style={styles.invite}>
            <Text variant="caption" color="textDisabled">
              {handle ? 'Join with code' : 'One balance, any trade'}
            </Text>
            {handle ? (
              <Text variant="heading" color="textOnLight">
                {handle.toUpperCase()}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {shareError ? <Text variant="caption" color="danger">{shareError}</Text> : null}
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
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.bgBase,
    minHeight: 380,
  },
  orbit: {
    position: 'absolute',
    right: -120,
    top: -90,
    borderWidth: 1,
    borderColor: colors.accentPink,
  },
  watermark: {
    position: 'absolute',
    right: -50,
    top: 20,
    opacity: 0.14,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.xl,
  },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ownerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.accentPink,
    backgroundColor: colors.accentPinkDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stamp: {
    alignItems: 'flex-end',
  },
  body: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pnl: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  prices: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  liq: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerDim,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surfaceLight,
  },
  invite: {
    alignItems: 'flex-end',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
