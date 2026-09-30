import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { EngineUnavailable } from '@/api/client';
import { onboardPerps, type PerpsAccess } from '@/api/perps';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

function onboardError(e: unknown): string {
  if (e instanceof EngineUnavailable && e.status === 409) {
    // The engine's 409s are written for people (e.g. Paradex's minimum-balance rule), except the
    // permission race right after granting.
    if (/approve atlas perps access/i.test(e.message)) return "Atlas can't see your permission yet. Try again in a moment.";
    return e.message.replace(/\.?$/, '.');
  }
  if (e instanceof EngineUnavailable && e.status === 503) {
    console.warn('[atlas] perps onboarding not available:', e.message);
    return "Paradex sign-up isn't open on Atlas right now.";
  }
  // Other venue failures come back as 5xx with Paradex's raw reason: keep that for debugging.
  if (e instanceof EngineUnavailable && (e.status ?? 0) >= 500) {
    console.warn('[atlas] perps onboarding failed:', e.message);
    return "Paradex didn't accept the sign-up. Try again in a bit.";
  }
  return `Couldn't set up your Paradex account: ${errorMessage(e)}`;
}

// One-time perps setup, kept apart from trading so a trade is still a single confirmation.
// Step 1 is the user's permission: the engine's Privy server signer is added to their wallet. Step 2
// is Paradex's own onboarding, which the engine does with that permission and reports back. One tap
// runs both. Once both are done this renders nothing: turning it off lives in Profile.
export function EnablePerps({ access }: { access: PerpsAccess }) {
  const { authorizeServerSigner, walletsReady, getAccessToken } = useAtlasAuth();
  const { status, error: statusError, reload, authorized, onboarded, signer } = access;
  const [busy, setBusy] = useState<'grant' | 'onboard' | null>(null);
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

  if (!status || (authorized && onboarded)) return null;

  return (
    <Card variant="outlined" style={styles.card}>
      <Text variant="heading">Enable perps</Text>
      <Text color="textSecondary">
        Perps orders go to Paradex. To place them for you, Atlas&apos;s trading service needs your permission to sign
        perps orders for your wallet. You still confirm every trade in the app, your keys never leave Privy, and you can
        turn this off any time in Profile.
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
            ? `Set up${status.accountAddress ? ` · ${short(status.accountAddress)}` : ''}`
            : busy === 'onboard'
              ? 'Opening your Paradex account…'
              : authorized
                ? 'Not set up yet'
                : 'Opened by Atlas right after step 1'
        }
        pending={busy === 'onboard'}
      />

      {actionError ? <Text color="danger">{actionError}</Text> : null}
      {statusError ? (
        <Text variant="caption" color="textSecondary">
          {statusError}
        </Text>
      ) : null}
      {!authorized && !signer ? (
        <Text variant="caption" color="textSecondary">
          Atlas&apos;s trading service isn&apos;t accepting permissions yet. Check back soon.
        </Text>
      ) : null}

      <PillButton
        label={authorized ? 'Set up Paradex account' : 'Enable perps'}
        icon="flash-outline"
        loading={busy !== null}
        disabled={!walletsReady || busy !== null || (!authorized && !signer)}
        onPress={setUp}
      />
    </Card>
  );
}

// Profile's view of perps access: where it's on, which Paradex account, and the way to turn it off.
export function PerpsAccessSettings({ access }: { access: PerpsAccess }) {
  const { revokeServerSigners } = useAtlasAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status, authorized, reload } = access;
  if (!authorized) return null;

  const turnOff = async () => {
    setBusy(true);
    setError(null);
    try {
      await revokeServerSigners();
      await reload();
    } catch (e) {
      setError(`Couldn't turn off perps access: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.settings}>
      <View style={styles.settingsRow}>
        <View style={styles.settingsIcon}>
          <Icon name="flash-outline" size={18} color="accentPinkTint" />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">Perps access</Text>
          <Text variant="caption" color="textSecondary">
            {access.onboarded && status?.accountAddress
              ? `On · Paradex account ${short(status.accountAddress)}`
              : 'On · Paradex account not set up yet'}
          </Text>
        </View>
      </View>
      {error ? <Text color="danger">{error}</Text> : null}
      <PillButton label="Turn off perps access" tone="secondary" size="sm" loading={busy} onPress={turnOff} />
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
  settings: {
    gap: spacing.md,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
});
