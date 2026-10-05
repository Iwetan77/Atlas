import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { colors, themedStyles } from '@/theme';

// What a market is about, from its question, for the tile shown when it has no picture.
function topicIcon(question: string): IconName {
  const q = question.toLowerCase();
  if (/bitcoin|btc|ethereum|eth\b|crypto|solana/.test(q)) return 'logo-bitcoin';
  if (/football|soccer|uefa|premier league|nfl|nba|vs\.|win on|champions/.test(q)) return 'football-outline';
  if (/election|president|senate|house|vote|minister|governor/.test(q)) return 'flag-outline';
  if (/fed\b|rate|inflation|gdp|recession|economy|price of/.test(q)) return 'stats-chart-outline';
  if (/\bai\b|openai|anthropic|google|apple|tesla|nvidia|tech/.test(q)) return 'hardware-chip-outline';
  return 'planet-outline';
}

// A market's picture, or a pink tile with its topic's icon when it has none or it doesn't load.
export function MarketArt({ uri, question, size = 44 }: { uri: string | null; question: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.28);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.art, { width: size, height: size, borderRadius: radius }]}
        contentFit="cover"
        transition={150}
        recyclingKey={uri}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.art, styles.tile, { width: size, height: size, borderRadius: radius }]}>
      <Icon name={topicIcon(question)} size={Math.round(size * 0.48)} color="accentPinkTint" />
    </View>
  );
}

const styles = themedStyles(() => ({
  art: {
    backgroundColor: colors.bgSurfaceAlt,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPinkMuted,
  },
}));
