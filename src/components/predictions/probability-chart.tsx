import { useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { usePredictionChart, type PredictionChartRange } from '@/api/predictions';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, subscribeTheme, themedStyles, themeName } from '@/theme';

const RANGES: PredictionChartRange[] = ['1D', '1W', '1M', 'ALL'];
const HEIGHT = 180, TOP = 10, RIGHT = 35, BOTTOM = 12;
const sayChance = (p: number) => (p * 100).toFixed(1).replace(/\.0$/, '') + '%';
const dateLabel = (ms: number) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// Real outcome-token histories. A gap in the venue's data is never invented as a flat price.
export function ProbabilityChart({ marketId }: { marketId: string }) {
  useSyncExternalStore(subscribeTheme, themeName, themeName);
  const [range, setRange] = useState<PredictionChartRange>('1D');
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const { chart, loading, error } = usePredictionChart(marketId, range);
  const series = chart?.series ?? [];
  const times = series.flatMap((s) => s.points.map(([t]) => t));
  const from = times.length ? Math.min(...times) : 0, to = times.length ? Math.max(...times) : 0;
  const plotWidth = Math.max(1, width - RIGHT);
  const x = (t: number) => (t - from) / (to - from || 1) * plotWidth;
  const y = (p: number) => TOP + (1 - p) * (HEIGHT - TOP - BOTTOM);
  const strokes = [colors.accentPink, colors.tileBlue];
  const selectedTime = selected === null ? null : from + selected / plotWidth * (to - from);
  const nearest = (points: [number, number][]) => selectedTime === null ? points.at(-1)
    : points.reduce<[number, number] | undefined>((best, p) => !best || Math.abs(p[0] - selectedTime) < Math.abs(best[0] - selectedTime) ? p : best, undefined);
  const haveHistory = series.some((s) => s.points.length >= 2);
  const pick = (position: number) => setSelected(Math.max(0, Math.min(plotWidth, position)));
  return <View style={styles.card}>
    <View style={styles.heading}>
      <View style={styles.titleRow}><Text variant="bodyStrong">Market chances</Text>
        {loading && haveHistory ? <ActivityIndicator size="small" color={colors.accentPink} /> : null}</View>
      <Text variant="caption" color="textSecondary">{selectedTime === null ? 'How the market has changed' : dateLabel(selectedTime)}</Text>
    </View>
    <View style={styles.legend}>{series.map((s, i) => {
      const point = nearest(s.points);
      return <View key={s.tokenId} style={styles.outcome}>
        <View style={[styles.dot, { backgroundColor: strokes[i] }]} />
        <Text variant="caption" numberOfLines={1} style={styles.label}>{s.label}</Text>
        <Text variant="bodyStrong">{point ? sayChance(point[1]) : '—'}</Text>
      </View>;
    })}</View>
    <Pressable accessibilityRole="button" accessibilityLabel="Prediction probability chart. Tap to inspect a time."
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onPress={(event) => pick(event.nativeEvent.locationX)}
      onTouchMove={(event) => pick(event.nativeEvent.locationX)} style={styles.plot}>
      {haveHistory && width > RIGHT ? <Svg width={width} height={HEIGHT}>
        <>
          {[0, 0.25, 0.5, 0.75, 1].map((p) => <Line key={p} x1={0} x2={plotWidth} y1={y(p)} y2={y(p)} stroke={colors.border} strokeWidth={0.6} />)}
          {[0, 0.5, 1].map((p) => <SvgText key={p} x={width} y={y(p) + 4} textAnchor="end" fontSize={10} fill={colors.textSecondary}>{Math.round(p * 100)}%</SvgText>)}
        </>
        {series.map((s, i) => <Path key={s.tokenId} d={s.points.map(([t, p], j) => (j ? 'L' : 'M') + x(t).toFixed(1) + ',' + y(p).toFixed(1)).join(' ')}
          stroke={strokes[i]} strokeWidth={2.2} strokeLinejoin="round" fill="none" />)}
        {selected !== null ? <Line x1={selected} x2={selected} y1={TOP} y2={HEIGHT - BOTTOM} stroke={colors.textSecondary} strokeDasharray="3,4" /> : null}
        {selected !== null ? series.map((s, i) => {
          const point = nearest(s.points);
          return point ? <Circle key={s.tokenId} cx={x(point[0])} cy={y(point[1])} r={4} fill={strokes[i]} stroke={colors.bgSurface} strokeWidth={2} /> : null;
        }) : null}
      </Svg> : <View style={styles.empty}>{loading ? <ActivityIndicator color={colors.accentPink} /> : null}
        <Text variant="caption" color="textSecondary">{loading ? 'Loading history…' : error ? 'Chart is unavailable right now' : 'Not enough trading history yet'}</Text></View>}
    </Pressable>
    {haveHistory ? <View style={styles.dates}><Text variant="caption" color="textSecondary">{new Date(from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
      <Text variant="caption" color="textSecondary">{new Date(to).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text></View> : null}
    <View style={styles.ranges}>{RANGES.map((r) => <Pressable key={r} accessibilityRole="tab" accessibilityState={{ selected: range === r }} aria-selected={range === r}
      onPress={() => { setSelected(null); setRange(r); }} style={[styles.range, range === r && styles.active]}>
      <Text variant="caption" color={range === r ? 'accentPinkTint' : 'textSecondary'}>{r === 'ALL' ? 'All' : r}</Text>
    </Pressable>)}</View>
  </View>;
}
const styles = themedStyles(() => ({
  card: { backgroundColor: colors.bgSurface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  heading: { gap: spacing.xs }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legend: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  outcome: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  dot: { width: 7, height: 7, borderRadius: radii.pill }, label: { flexShrink: 1 },
  plot: { height: HEIGHT }, empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  dates: { flexDirection: 'row', justifyContent: 'space-between' },
  ranges: { flexDirection: 'row', gap: spacing.xs, padding: spacing.xs, backgroundColor: colors.bgTabBar, borderRadius: radii.pill },
  range: { flex: 1, minHeight: 36, justifyContent: 'center', alignItems: 'center', borderRadius: radii.pill },
  active: { backgroundColor: colors.accentPinkMuted },
}));
