import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { ChartRange } from '@/api/contract';
import { useAssetChart } from '@/api/markets';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, themedStyles } from '@/theme';

const RANGES: { key: ChartRange; label: string; span: string }[] = [
  { key: '1D', label: '1D', span: 'today' },
  { key: '1W', label: '1W', span: 'past week' },
  { key: '1M', label: '1M', span: 'past month' },
  { key: '1Y', label: '1Y', span: 'past year' },
];
const HEIGHT = 170;
const PAD = 8;

// The asset's price over a range: one line, green when it's up over the range, red when down.
// Display only; the trade itself always uses a live quote.
export function PriceChart({ assetId }: { assetId: string }) {
  const [range, setRange] = useState<ChartRange>('1D');
  const [width, setWidth] = useState(0);
  const { chart, loading, error } = useAssetChart(assetId, range);
  const points = chart?.points ?? [];
  const first = points[0]?.[1];
  const last = points[points.length - 1]?.[1];
  const change = first && last ? ((last - first) / first) * 100 : null;
  const up = change === null || change >= 0;
  const stroke = up ? colors.success : colors.danger;

  return (
    <View style={styles.wrap}>
      <View style={styles.changeRow}>
        {change === null ? (
          <Text variant="caption" color="textSecondary">
            {error ? "Chart isn't available right now" : loading ? 'Loading chart…' : 'Not enough history yet'}
          </Text>
        ) : (
          <Text variant="caption" color={up ? 'success' : 'danger'}>
            {up ? '+' : ''}
            {change.toFixed(2)}% {RANGES.find((r) => r.key === range)?.span}
          </Text>
        )}
      </View>

      <View style={styles.plot} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && points.length >= 2 ? (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
                <Stop offset="1" stopColor={stroke} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {(() => {
              const { line, area } = paths(points, width, HEIGHT);
              return (
                <>
                  <Path d={area} fill="url(#fill)" />
                  <Path d={line} stroke={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" />
                </>
              );
            })()}
          </Svg>
        ) : (
          <View style={[styles.placeholder, loading && styles.placeholderLoading]} />
        )}
      </View>

      <View style={styles.ranges}>
        {RANGES.map((r) => {
          const active = r.key === range;
          return (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.range, active && styles.rangeActive]}>
              <Text variant="label" color={active ? 'textOnAccent' : 'textSecondary'}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function paths(points: [number, number][], width: number, height: number) {
  const prices = points.map(([, p]) => p);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const spread = max - min || max || 1;
  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (p: number) => PAD + (1 - (p - min) / spread) * (height - 2 * PAD);
  const line = points.map(([, p], i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  return { line, area: `${line} L${width},${height} L0,${height} Z` };
}

const styles = themedStyles(() => ({
  wrap: {
    gap: spacing.sm,
  },
  changeRow: {
    minHeight: 18,
  },
  plot: {
    height: HEIGHT,
  },
  placeholder: {
    flex: 1,
    borderRadius: radii.lg,
  },
  placeholderLoading: {
    backgroundColor: colors.bgSurface,
    opacity: 0.5,
  },
  ranges: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  range: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSurface,
  },
  rangeActive: {
    backgroundColor: colors.accentPink,
  },
}));
