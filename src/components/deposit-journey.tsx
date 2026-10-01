import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DepositHopTx, DepositJourney as Journey } from '@/api/contract';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

const short = (hash: string) => (hash.length > 14 ? `${hash.slice(0, 6)}…${hash.slice(-6)}` : hash);

// Every hop a deposit takes, folded under its status line: sent on its own network, swapped on NEAR
// Intents, paid out as USDC to the user's Solana wallet. Each transaction opens in its explorer.
export function DepositJourney({ journey, network }: { journey: Journey | null; network: string }) {
  const [open, setOpen] = useState(false);
  const hops: { key: keyof Journey; title: string; waiting: string }[] = [
    { key: 'deposit', title: `Your deposit on ${network}`, waiting: 'Waiting for it to arrive' },
    { key: 'swap', title: 'Turned into dollars on NEAR Intents', waiting: 'Starts once your deposit arrives' },
    { key: 'payout', title: 'USDC sent to your Solana wallet', waiting: 'Last step' },
  ];
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={styles.toggle}>
        <Text variant="label" color="accentPinkTint">
          {open ? 'Hide the steps' : 'See each step'}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color="accentPinkTint" />
      </Pressable>
      {open ? (
        <View style={styles.hops}>
          {hops.map((hop, i) => {
            const txs = journey?.[hop.key] ?? [];
            const done = txs.length > 0;
            return (
              <View key={hop.key} style={styles.hop}>
                <View style={styles.rail}>
                  <View style={[styles.dot, done && styles.dotDone]} />
                  {i < hops.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={styles.body}>
                  <Text variant="bodyStrong" color={done ? 'textPrimary' : 'textSecondary'}>
                    {hop.title}
                  </Text>
                  {done ? (
                    txs.map((tx) => <TxLink key={tx.hash} tx={tx} />)
                  ) : (
                    <Text variant="caption" color="textSecondary">
                      {hop.waiting}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function TxLink({ tx }: { tx: DepositHopTx }) {
  if (!tx.url) {
    return (
      <Text variant="caption" color="textSecondary">
        {short(tx.hash)}
      </Text>
    );
  }
  const url = tx.url;
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(url)}
      accessibilityRole="link"
      accessibilityLabel={`Open transaction ${short(tx.hash)}`}
      hitSlop={6}
      style={styles.link}>
      <Text variant="caption" color="accentPinkTint">
        {short(tx.hash)}
      </Text>
      <Icon name="open-outline" size={12} color="accentPinkTint" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  hops: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bgSurfaceAlt,
  },
  hop: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    alignItems: 'center',
    width: 12,
  },
  dot: {
    width: 10,
    height: 10,
    marginTop: 5,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
  },
  dotDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: 2,
    backgroundColor: colors.border,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
    paddingBottom: spacing.md,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    alignSelf: 'flex-start',
  },
});
