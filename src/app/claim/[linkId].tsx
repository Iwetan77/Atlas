import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

import type { CashLink, IntentStatus } from '@/api/contract';
import { StillSettling, waitForIntent } from '@/api/intents';
import { claimCashLink, getCashLink, getCashLinkClaim } from '@/api/send';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { EmailOtpForm } from '@/components/email-otp-form';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/format/money';
import { clearPendingClaim, pendingClaimSecret, rememberPendingClaim } from '@/funding/claim-continuation';
import { decodeLinkSecret } from '@/funding/link-key';
import { usePaymentPin, PinCancelled } from '@/security/pin-provider';
import { colors, radii, spacing, themedStyles } from '@/theme';

type Phase = { kind: 'view' } | { kind: 'claiming' } | { kind: 'pending' } | { kind: 'done' } | { kind: 'failed'; message: string };

// The private fragment survives Google redirects, wallet setup, PIN setup and navigator remounts.
export default function ClaimScreen() {
  const { linkId, code, k } = useLocalSearchParams<{ linkId?: string; code?: string; k?: string }>();
  const id = linkId ?? code ?? '';
  const pathname = usePathname();
  const fromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.replace(/^#/, '')).get('k') : k;
  const secret = decodeLinkSecret(fromUrl ?? k ?? '') || pendingClaimSecret(id);
  const paymentPin = usePaymentPin();
  const { authenticated, userId, getAccessToken, loginWithGoogle, googleLoading, googleError, emailLogin } = useAtlasAuth();
  const session = useRef({ userId, mounted: true });
  useLayoutEffect(() => { session.current.userId = userId; }, [userId]);
  const sending = useRef(false);
  const [link, setLink] = useState<CashLink | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'view' });
  const [useEmail, setUseEmail] = useState(false);
  useEffect(() => {
    const current = session.current;
    current.mounted = true;
    return () => { current.mounted = false; };
  }, []);
  useEffect(() => { if (secret) rememberPendingClaim(id, secret, pathname); }, [id, secret, pathname]);
  const load = useCallback(async () => {
    const next = await getCashLink(id);
    setLink(next); setLoadError(null);
    return next;
  }, [id]);
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(async () => {
      if (!live) return;
      setLink(null); setLoadError(null); setPhase({ kind: 'view' });
      try { const next = await getCashLink(id); if (live) setLink(next); }
      catch (error) { if (live) setLoadError(errorMessage(error)); }
    });
    return () => { live = false; };
  }, [id]);
  const finish = useCallback((status: IntentStatus) => {
    if (status.state === 'filled') { clearPendingClaim(id); setPhase({ kind: 'done' }); }
    else if (status.state === 'failed') setPhase({ kind: 'failed', message: status.error ?? 'The claim did not finish. Your money remains in the link.' });
    else setPhase({ kind: 'pending' });
  }, [id]);
  // A refresh or a dropped submit response follows the exact existing claim.
  // Changing view to pending must not cancel its observer.
  const recovering = authenticated && !!link?.claimIntentId && (phase.kind === 'view' || phase.kind === 'pending');
  const canonicalId = link?.linkId;
  useEffect(() => {
    if (!recovering || !canonicalId) return;
    let live = true;
    const owner = userId;
    const active = () => live && session.current.userId === owner;
    void (async () => {
      while (active()) {
        try {
          const status = await getCashLinkClaim(getAccessToken, canonicalId);
          if (!active() || !status) return;
          if (status.state === 'filled' || status.state === 'failed') { finish(status); return; }
          setPhase({ kind: 'pending' });
          try {
            const final = await waitForIntent(getAccessToken, status);
            if (!active()) return;
            finish(final);
            if (final.state === 'filled' || final.state === 'failed') return;
          } catch (error) {
            if (!active()) return;
            if (!(error instanceof StillSettling)) setLoadError(errorMessage(error));
          }
        } catch (error) { if (active()) setLoadError(errorMessage(error)); }
        await new Promise(resolve => setTimeout(resolve, 4_000));
      }
    })();
    return () => { live = false; };
  }, [recovering, canonicalId, userId, getAccessToken, finish]);

  const claim = async () => {
    if (!link || sending.current || !userId) return;
    sending.current = true;
    const owner = userId;
    const active = () => session.current.mounted && session.current.userId === owner;
    const token = async () => {
      if (!active()) throw new PinCancelled();
      const value = await getAccessToken();
      if (!active()) throw new PinCancelled();
      return value;
    };
    setPhase({ kind: 'claiming' });
    try {
      const grant = await paymentPin.request({ title: 'Receive your money',
        action: { type: 'cashlink', linkId: link.linkId, secret },
        summary: [{ label: 'You receive', value: formatMoney(link.amount) }] });
      if (!active()) return;
      const first = await claimCashLink(token, link.linkId, secret, grant.authorization);
      if (!active()) return;
      // Persist the submitted intent in view state so the same observer also survives
      // a provider timeout. It follows this claim; it never submits another payout.
      setLink({ ...link, state: 'processing', claimIntentId: first.intentId });
      finish(first);
    } catch (error) {
      if (!active()) return;
      if (error instanceof PinCancelled) setPhase({ kind: 'view' });
      else if (error instanceof StillSettling) setPhase({ kind: 'pending' });
      else {
        // Submission may have reached Relay even when its response was lost.
        const existing = await getCashLinkClaim(token, link.linkId).catch(() => null);
        if (active()) {
          if (existing) { finish(existing); await load(); }
          else setPhase({ kind: 'failed', message: errorMessage(error) });
        }
      }
    } finally { sending.current = false; }
  };
  const check = async () => {
    if (!link || sending.current) return;
    sending.current = true;
    try {
      const status = await getCashLinkClaim(getAccessToken, link.linkId);
      if (status) finish(status);
      else { await load(); setPhase({ kind: 'view' }); }
    } catch (error) { setPhase({ kind: 'failed', message: errorMessage(error) }); }
    finally { sending.current = false; }
  };
  const from = link?.sender.handle ? `@${link.sender.handle}` : link?.sender.displayName ?? 'Someone';

  return <Screen style={styles.screen}>
    <View style={styles.wordmark}><Image source={require('../../../assets/images/icon.png')} style={styles.logo} />
      <Text variant="title">atlas<Text variant="title" color="accentPink">.</Text></Text></View>
    {!link ? <View style={styles.loading}>{loadError ? <>
      <Text variant="heading">This link couldn&apos;t open</Text><Text color="textSecondary">{loadError}</Text>
      <PillButton label="Try again" tone="secondary" onPress={() => load().catch((error) => setLoadError(errorMessage(error)))} />
    </> : <ActivityIndicator color={colors.accentPink} />}</View> : <>
      <View style={styles.gift}>
        <View style={styles.giftIcon}><Icon name={phase.kind === 'done' ? 'checkmark' : 'gift-outline'} size={32} color="textOnAccent" /></View>
        <Text variant="overline" style={styles.giftLabel}>{phase.kind === 'done' ? 'IN YOUR ATLAS BALANCE' : `A GIFT FROM ${from.toUpperCase()}`}</Text>
        <Text variant="display" style={styles.amount}>{formatMoney(link.amount)}</Text>
        {link.message ? <Text style={styles.note}>“{link.message}”</Text> : null}
        <View style={styles.giftFooter}><Icon name="shield-checkmark-outline" size={15} color="textOnAccent" />
          <Text variant="caption" style={styles.giftLabel}>{phase.kind === 'done' ? 'Delivered to your Atlas balance' : 'Receive securely in your Atlas balance'}</Text></View>
      </View>
      {phase.kind === 'done' ? <>
        <Text variant="heading" style={styles.center}>Your money has arrived</Text>
        <PillButton label="Open Atlas" onPress={() => router.replace('/')} />
      </> : phase.kind === 'pending' || phase.kind === 'claiming' ? <View style={styles.loading}>
        <ActivityIndicator color={colors.accentPink} /><Text variant="heading">Delivering your money</Text>
        <Text color="textSecondary" style={styles.center}>Your claim is processing. You can safely check its progress here.</Text>
        {phase.kind === 'pending' ? <PillButton label="Check progress" tone="secondary" onPress={check} /> : null}
      </View> : link.state === 'claimed' || link.state === 'processing' || link.state === 'cancelled' || link.state === 'expired' ? <View style={styles.loading}>
        <Text variant="heading">{link.state === 'processing' ? 'This gift is being delivered' : link.state === 'claimed' ? 'This gift was claimed' : link.state === 'expired' ? 'This link expired' : 'The sender took it back'}</Text>
        {link.claimIntentId && authenticated ? <PillButton label="Check my claim" tone="secondary" onPress={check} /> : null}
      </View> : !secret ? <Text color="danger">This link is incomplete. Ask the sender to share the full link again.</Text> : authenticated ? <>
        {phase.kind === 'failed' ? <Text color="danger" accessibilityRole="alert">{phase.message}</Text> : null}
        <Text color="textSecondary" style={styles.center}>Your gift is ready. Tap below to receive it.</Text>
        <PillButton label={`Claim ${formatMoney(link.amount)}`} icon="gift-outline" onPress={claim} />
      </> : useEmail ? <EmailOtpForm flow={emailLogin} /> : <View style={styles.actions}>
        <Text variant="heading" style={styles.center}>Sign in to receive your gift</Text>
        <Text color="textSecondary" style={styles.center}>New to Atlas? Set up your username and PIN, then come straight back to claim your money.</Text>
        <PillButton label="Continue with Google" icon="logo-google" loading={googleLoading} onPress={() => { rememberPendingClaim(id, secret, pathname); loginWithGoogle(); }} />
        <PillButton label="Continue with email" icon="mail-outline" tone="secondary" onPress={() => { rememberPendingClaim(id, secret, pathname); setUseEmail(true); }} />
        {googleError ? <Text color="danger">{googleError}</Text> : null}
      </View>}
    </>}
  </Screen>;
}
const styles = themedStyles(() => ({
  screen: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: spacing.xl },
  wordmark: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  logo: { width: 32, height: 32, borderRadius: radii.sm },
  gift: { backgroundColor: colors.accentPink, borderRadius: radii.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.md, overflow: 'hidden' },
  giftIcon: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.accentPinkDeep, alignItems: 'center', justifyContent: 'center' },
  giftLabel: { color: colors.textOnAccent, textAlign: 'center' },
  amount: { color: colors.textOnAccent, textAlign: 'center', fontSize: 44, lineHeight: 54 },
  note: { color: colors.textOnAccent, textAlign: 'center' },
  giftFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.md },
  center: { textAlign: 'center' },
  actions: { gap: spacing.md },
  loading: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
}));
