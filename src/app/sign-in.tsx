import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { useAtlasAuth } from '@/auth/context';
import { Icon, type IconName } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';
import { useDesktop } from '@/web/use-desktop';
import { DesktopWelcome } from '@/components/web/welcome';

// Things one balance can buy, floating over the glow: the "anything" in the tagline, made visible.
const CHIPS: { icon: IconName; label: string; style: object }[] = [
  { icon: 'cash-outline', label: '₦ Naira', style: { top: 18, left: 8 } },
  { icon: 'trending-up', label: 'TSLA', style: { top: 70, right: 4 } },
  { icon: 'flame-outline', label: 'Memes', style: { top: 138, left: 28 } },
  { icon: 'planet-outline', label: 'SOL', style: { top: 180, right: 36 } },
];

const ORBITS = [120, 190, 260];

export default function SignInScreen() {
  const { loginWithGoogle, googleLoading, googleError, ready } = useAtlasAuth();
  const desktop = useDesktop();
  if (desktop) return <DesktopWelcome />;

  return (
    <Screen scroll={Platform.OS === 'web'} style={styles.screen}>
      <Text variant="title" color="accentPink">
        atlas
      </Text>

      <View style={styles.hero}>
        {/* Orbits around a glowing core: the "atlas" of everything one balance reaches. */}
        {ORBITS.map((size, i) => (
          <View
            key={size}
            style={[styles.orbit, { width: size, height: size, borderRadius: size / 2, opacity: 0.5 - i * 0.12 }]}
          />
        ))}
        <LinearGradient
          colors={[colors.accentPinkTint, colors.accentPink, colors.accentPinkDim]}
          start={{ x: 0.3, y: 0.1 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.core}
        />
        {CHIPS.map((c) => (
          <View key={c.label} style={[styles.chip, c.style]}>
            <Icon name={c.icon} size={16} color="accentPinkTint" />
            <Text variant="label">{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.copy}>
        <Text variant="display">One balance.{'\n'}Spend it on anything.</Text>
        <Text color="textSecondary">Fund it in naira. Buy stocks, memes and crypto. Cash out to your bank.</Text>
      </View>

      <View style={styles.actions}>
        <PillButton label="Continue with Google" disabled={!ready} icon="logo-google" loading={googleLoading} onPress={loginWithGoogle} />
        <PillButton
          label="Continue with email"
          icon="mail-outline"
          tone="secondary"
          onPress={() => router.push('/sign-in-email')}
        />
        {googleError ? <Text color="danger">{googleError}</Text> : null}
        <View style={styles.note}>
          <Icon name="shield-checkmark-outline" size={14} color="textSecondary" />
          <Text variant="caption" color="textSecondary">
            No seed phrase. Your wallet is set up for you.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'space-between',
    gap: spacing.xl,
  },
  hero: {
    flex: 1,
    minHeight: 220,
    maxHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbit: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.accentPink,
  },
  core: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  copy: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
