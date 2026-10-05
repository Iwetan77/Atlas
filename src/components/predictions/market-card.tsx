import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { PredictionMarket } from '@/api/predictions';
import { MarketArt } from '@/components/predictions/market-art';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, themedStyles } from '@/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "63%", or "<1%" and ">99%" at the ends, where a rounded 0% or 100% would mislead.
export function percent(probability: string): string {
  const p = Number(probability) * 100;
  if (!Number.isFinite(p)) return '–';
  if (p > 0 && p < 1) return '<1%';
  if (p < 100 && p > 99) return '>99%';
  return `${Math.round(p)}%`;
}

// "Ends Dec 31", with the year when it isn't this one.
export function endsLabel(endDate: string | null): string | null {
  if (!endDate) return null;
  const d = new Date(endDate);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear() === new Date().getFullYear() ? '' : `, ${d.getFullYear()}`;
  return `Ends ${MONTHS[d.getMonth()]} ${d.getDate()}${year}`;
}

// "$2.1M vol": how much has been traded on it, as the market reports it (in dollars).
export function volumeLabel(volumeUsd: string): string | null {
  const v = Number(volumeUsd);
  if (!Number.isFinite(v) || v < 1) return null;
  const [n, unit] = v >= 1e9 ? [v / 1e9, 'B'] : v >= 1e6 ? [v / 1e6, 'M'] : v >= 1e3 ? [v / 1e3, 'K'] : [v, ''];
  return `$${n >= 100 || unit === '' ? Math.round(n) : n.toFixed(1).replace(/\.0$/, '')}${unit} vol`;
}

// One market in the list: its picture and question, the chance of Yes, and both outcomes one tap
// from buying.
export function MarketCard({ market: m, wide }: { market: PredictionMarket; wide?: boolean }) {
  const open = (tokenId?: string) =>
    router.push({ pathname: '/predictions/[marketId]', params: tokenId ? { marketId: m.marketId, tokenId } : { marketId: m.marketId } });
  const yes = m.outcomes[0]?.label.toLowerCase() === 'yes' ? m.outcomes[0] : null;
  const meta = [endsLabel(m.endDate), volumeLabel(m.volumeUsd)].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => open()}
      accessibilityRole="button"
      accessibilityLabel={m.question}
      style={({ pressed }) => [styles.card, wide && styles.wide, pressed && styles.pressed]}>
      <View style={styles.top}>
        <MarketArt uri={m.iconUrl} question={m.question} />
        <View style={styles.text}>
          <Text variant="bodyStrong" numberOfLines={3}>
            {m.question}
          </Text>
          {meta ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {yes ? (
          <View style={styles.chance}>
            <Text variant="heading">{percent(yes.probability)}</Text>
            <Text variant="caption" color="textSecondary">
              chance
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.outcomes}>
        {m.outcomes.map((o, i) => (
          <Pressable
            key={o.tokenId}
            onPress={() => open(o.tokenId)}
            accessibilityRole="button"
            accessibilityLabel={`${o.label}, ${percent(o.probability)}`}
            style={({ pressed }) => [styles.outcome, i === 0 ? styles.first : styles.second, pressed && styles.pressed]}>
            <Text variant="label" color={i === 0 ? 'accentPinkTint' : 'tileBlue'} numberOfLines={1} style={styles.outcomeLabel}>
              {o.label}
            </Text>
            <Text variant="label" color={i === 0 ? 'accentPinkTint' : 'tileBlue'}>
              {percent(o.probability)}
            </Text>
          </Pressable>
        ))}
      </View>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  card: {
    width: '100%',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.bgSurface,
  },
  wide: {
    width: '48%',
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  chance: {
    alignItems: 'flex-end',
    minWidth: 52,
  },
  outcomes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  outcome: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
  },
  outcomeLabel: {
    flexShrink: 1,
  },
  first: {
    backgroundColor: colors.accentPinkMuted,
  },
  second: {
    backgroundColor: colors.bgTabBar,
  },
}));
