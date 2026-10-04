import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import type { CashLink } from '@/api/contract';
import { waitForIntent } from '@/api/intents';
import { claimCashLink, getCashLink } from '@/api/send';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { EmailOtpForm } from '@/components/email-otp-form';
import { ResultView } from '@/components/result-view';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/format/money';
import { usePaymentPin, PinCancelled } from '@/security/pin-provider';
import { colors, spacing } from '@/theme';

// The link secret rides in the URL fragment (#k=…) on the web; a native deep link passes ?k=.
// Google sign-in leaves the page and may drop the fragment on the way back, so the secret is kept
// in this tab's session storage until the claim is done.
function useLinkSecret(linkId: string): string {
  const { k } = useLocalSearchParams<{ k?: string }>();
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const key = `atlas:claim:${linkId}`;
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('k');
    try {
      if (fromHash) window.sessionStorage.setItem(key, fromHash);
      return fromHash ?? window.sessionStorage.getItem(key) ?? '';
    } catch {
      return fromHash ?? '';
    }
  }
  return k ?? '';
}

type Phase = { kind: 'view' } | { kind: 'claiming' } | { kind: 'done'; amount: string } | { kind: 'failed'; message: string };

// Public claim page: works without the app. Sign-in happens right here, so the link isn't lost.
export default function ClaimScreen() {
  const { linkId } = useLocalSearchParams<{ linkId: string }>();
  const secret = useLinkSecret(linkId);
  const paymentPin = usePaymentPin();
  const { authenticated, getAccessToken, loginWithGoogle, googleLoading, emailLogin } = useAtlasAuth();

  const [link, setLink] = useState<CashLink | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'view' });
  const [useEmail, setUseEmail] = useState(false);

  useEffect(() => {
    getCashLink(linkId)
      .then(setLink)
      .catch((e) => setLoadError(errorMessage(e)));
  }, [linkId]);

  const claim = async () => {
    if (!link) return;
    setPhase({ kind: 'claiming' });
    try {
      const grant = await paymentPin.request({ title: 'Receive your money',
        action: { type: 'cashlink', linkId: link.linkId, secret },
        summary: [{ label: 'You receive', value: formatMoney(link.amount) }] });
      const first = await claimCashLink(getAccessToken, link.linkId, secret, grant.authorization);
      const final = await waitForIntent(getAccessToken, first);
      setPhase(
        final.state === 'filled'
          ? { kind: 'done', amount: formatMoney(link.amount) }
          : { kind: 'failed', message: final.error ?? 'This link could not be claimed.' },
      );
    } catch (e) {
      setPhase(e instanceof PinCancelled ? { kind: 'view' } : { kind: 'failed', message: errorMessage(e) });
    }
  };

  if (phase.kind === 'done') {
    return (
      <ResultView title={`${phase.amount} is yours`} subtitle="It's in your Atlas balance.">
        <PillButton label="Open Atlas" onPress={() => router.replace('/')} />
      </ResultView>
    );
  }

  const from = link?.sender.displayName ?? (link?.sender.handle ? `@${link.sender.handle}` : 'Someone');

  return (
    <Screen>
      <Text variant="title" color="accentPink">
        atlas
      </Text>

      {!link ? (
        loadError ? (
          <Card style={styles.center}>
            <Text variant="heading">This link doesn&apos;t work</Text>
            <Text color="textSecondary">{loadError}</Text>
          </Card>
        ) : (
          <ActivityIndicator color={colors.accentPink} />
        )
      ) : (
        <>
          <View style={styles.hero}>
            <Text color="textSecondary">{from} sent you</Text>
            <Text variant="display">{formatMoney(link.amount)}</Text>
            {link.message ? <Text style={styles.message}>“{link.message}”</Text> : null}
          </View>

          {link.state !== 'open' ? (
            <Card style={styles.center}>
              <Text variant="heading">
                {link.state === 'claimed' ? 'Already claimed' : link.state === 'expired' ? 'This link expired' : 'This link was cancelled'}
              </Text>
            </Card>
          ) : !secret ? (
            <Text color="danger">This link is incomplete. Ask the sender to share it again.</Text>
          ) : authenticated ? (
            <>
              {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
              <PillButton label={`Claim ${formatMoney(link.amount)}`} loading={phase.kind === 'claiming'} onPress={claim} />
            </>
          ) : useEmail ? (
            <EmailOtpForm flow={emailLogin} />
          ) : (
            <View style={styles.signIn}>
              <Text color="textSecondary">Sign in to claim it. New to Atlas? This creates your account.</Text>
              <PillButton label="Continue with Google" icon="logo-google" loading={googleLoading} onPress={loginWithGoogle} />
              <PillButton label="Continue with email" icon="mail-outline" tone="secondary" onPress={() => setUseEmail(true)} />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  message: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
  signIn: {
    gap: spacing.md,
  },
});
