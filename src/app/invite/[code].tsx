import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';

import { useAtlasAuth } from '@/auth/context';
import { EmailOtpForm } from '@/components/email-otp-form';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, themedStyles } from '@/theme';
import ClaimScreen from '@/app/claim/[linkId]';

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return /^@[a-z0-9_]{3,20}$/.test(code ?? '') ? <FriendInvitation handle={code.slice(1)} /> : <ClaimScreen />;
}
function FriendInvitation({ handle }: { handle: string }) {
  const { authenticated, loginWithGoogle, googleLoading, googleError, emailLogin } = useAtlasAuth();
  const [email, setEmail] = useState(false);
  return <Screen style={styles.screen}>
    <View style={styles.card}>
      <Image source={require('../../../assets/images/icon.png')} style={styles.logo} />
      <Text variant="overline" color="accentPinkTint">YOU&apos;RE INVITED</Text>
      <Text variant="title" style={styles.center}>@{handle} invites you to Atlas</Text>
      <Text color="textSecondary" style={styles.center}>One balance. Your world.</Text>
      <View style={styles.chips}>{['Send to friends', 'Stocks & crypto', 'Make predictions'].map((label) =>
        <View key={label} style={styles.chip}><Icon name="checkmark-circle" size={14} color="accentPink" /><Text variant="caption">{label}</Text></View>)}</View>
      <Text color="textSecondary" style={styles.center}>Choose your username, protect your account with a PIN, and explore what your money can do.</Text>
    </View>
    {authenticated ? <PillButton label="Open Atlas" onPress={() => router.replace('/')} /> : email ? <EmailOtpForm flow={emailLogin} /> : <>
      <PillButton label="Continue with Google" icon="logo-google" loading={googleLoading} onPress={loginWithGoogle} />
      <PillButton label="Continue with email" icon="mail-outline" tone="secondary" onPress={() => setEmail(true)} />
      {googleError ? <Text color="danger">{googleError}</Text> : null}
    </>}
  </Screen>;
}
const styles = themedStyles(() => ({
  screen: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: spacing.lg },
  card: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg,
    alignItems: 'center', padding: spacing.xl, gap: spacing.lg },
  logo: { width: 72, height: 72, borderRadius: 22 },
  center: { textAlign: 'center' },
  chips: { alignItems: 'center', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.accentPinkMuted, borderRadius: radii.pill },
}));
