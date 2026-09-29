import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { EngineUnavailable } from '@/api/client';
import { onboardPerps, usePerpsAccess } from '@/api/perps';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

function onboardError(e: unknown): string {
  if (e instanceof EngineUnavailable && e.status === 409) {
    return "Atlas can't see your permission yet. Try again in a moment.";
  }
  if (e instanceof EngineUnavailable && e.status === 503) {
    console.warn('[atlas] perps onboarding not available:', e.message);
    return "Paradex sign-up isn't open on Atlas right now.";
  }
  // Venue failures come back as 5xx with Paradex's raw reason: keep that for debugging, not the user.
  if (e instanceof EngineUnavailable && (e.status ?? 0) >= 500) {
    console.warn('[atlas] perps onboarding failed:', e.message);
    return "Paradex didn't accept the sign-up. Try again in a bit.";
  }
  return `Couldn't set up your Paradex account: ${errorMessage(e)}`;
}

// One-time perps setup, kept apart from trading so a trade is still a single confirmation.
// Step 1 is the user's permission: the engine's Privy server signer is added to their wallet. Step 2
// is Paradex's own onboarding, which the engine does with that permission and reports back. One tap
// runs both. Neither step means trading is open, so this never says "ready to trade".
export function EnablePerps() {
  const { authorizeServerSigner, revokeServerSigners, walletsReady, getAccessToken } = useAtlasAuth();
  const { status, error: statusError, reload, authorized, onboarded, signer } = usePerpsAccess();
  const [busy, setBusy] = useState<'grant' | 'onboard' | 'revoke' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const setUp = async () => {
    setActionError(null);
    try {
      if (!authorized) {
        if (!signer) return;
        setBusy('grant');
        try {
          await authorizeServerSigner(signer);
        } catch (e) {
          setActionError(`Couldn't enable perps: ${errorMessage(e)}`);
          return;
        }
      }
      if (!onboarded) {
        setBusy('onboard');
        try {
          await onboardPerps(getAccessToken);
        } catch (e) {
          setActionError(onboardError(e));
        }
      }
    } finally {
      await reload();
      setBusy(null);
    }
  };

  const revoke = async () => {
    setBusy('revoke');
    setActionError(null);
    try {
      await revokeServerSigners();
      await reload();
    } catch (e) {
      setActionError(`Couldn't turn off perps access: ${errorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  // Both steps done: a quiet status line, still with the way out.
  if (authorized && onboarded) {
    return (
      <View style={styles.enabledRow}>
        <Icon name="shield-checkmark" size={16} color="success" />
        <Text variant="caption" color="textSecondary" style={styles.flex}>
          Perps access on · Paradex account {status?.accountAddress ? short(status.accountAddress) : 'set up'}
        </Text>
        <Pressable onPress={revoke} disabled={busy !== null} hitSlop={8}>
          <Text variant="label" color="accentPinkTint">
            {busy === 'revoke' ? 'Turning off…' : 'Turn off'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Card variant="outlined" style={styles.card}>
      <Text variant="heading">Enable perps</Text>
      <Text color="textSecondary">
        Perps orders go to Paradex. To place them for you, Atlas&apos;s trading service needs your permission to sign
        perps orders for your wallet. You still confirm every trade in the app, your keys never leave Privy, and you can
        turn this off any time.
      </Text>

      <Step
        n={1}
        done={authorized}
        title="Allow Atlas to place perps orders"
        subtitle={authorized ? 'Allowed' : busy === 'grant' ? 'Waiting for Privy…' : 'One tap, once'}
        pending={busy === 'grant'}
      />
      <Step
        n={2}
        done={onboarded}
        title="Paradex account"
        subtitle={
          onboarded
            ? `Set up${status?.accountAddress ? ` · ${short(status.accountAddress)}` : ''}`
            : busy === 'onboard'
              ? 'Registering you with Paradex…'
              : authorized
                ? 'Not set up yet'
                : 'Set up by Atlas right after step 1'
        }
        pending={busy === 'onboard'}
      />

      {actionError ? <Text color="danger">{actionError}</Text> : null}
      {statusError ? (
        <Text variant="caption" color="textSecondary">
          {statusError}
        </Text>
      ) : null}
      {status && !authorized && !signer ? (
        <Text variant="caption" color="textSecondary">
          Atlas&apos;s trading service isn&apos;t accepting permissions yet. Check back soon.
        </Text>
      ) : null}

      <PillButton
        label={authorized ? 'Set up Paradex account' : 'Enable perps'}
        icon="flash-outline"
        loading={busy === 'grant' || busy === 'onboard'}
        disabled={!walletsReady || busy !== null || (!authorized && !signer)}
        onPress={setUp}
      />
      {authorized ? (
        <Pressable onPress={revoke} disabled={busy !== null} hitSlop={8} style={styles.turnOff}>
          <Text variant="label" color="textSecondary">
            {busy === 'revoke' ? 'Turning off…' : 'Turn off perps access'}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function Step({ n, done, title, subtitle, pending }: { n: number; done: boolean; title: string; subtitle: string; pending?: boolean }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepMark, done ? styles.stepDone : styles.stepTodo]}>
        {done ? (
          <Icon name="checkmark" size={14} color="textOnAccent" />
        ) : pending ? (
          <ActivityIndicator size="small" color={colors.accentPink} />
        ) : (
          <Text variant="label" color="textSecondary">
            {n}
          </Text>
        )}
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong" color={done ? 'textSecondary' : 'textPrimary'}>
          {title}
        </Text>
        <Text variant="caption" color="textSecondary">
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepMark: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDone: {
    backgroundColor: colors.accentPink,
  },
  stepTodo: {
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  turnOff: {
    alignSelf: 'center',
  },
  enabledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
