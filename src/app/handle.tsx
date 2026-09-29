import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { claimHandle, HANDLE_RE, normaliseHandle, resolveHandle } from '@/api/send';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { BackHeader } from '@/components/ui/back-header';
import { Field } from '@/components/ui/field';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';

type Check = { state: 'idle' | 'checking' | 'free' } | { state: 'taken' | 'error'; message: string };

// Pick the @handle friends use to send you money.
export default function HandleScreen() {
  const { getAccessToken } = useAtlasAuth();
  const [raw, setRaw] = useState('');
  // The last answer, tagged with the handle it's for. Anything newer is still being checked.
  const [answer, setAnswer] = useState<{ handle: string; check: Check } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handle = normaliseHandle(raw);
  const valid = HANDLE_RE.test(handle);
  const check: Check = !valid ? { state: 'idle' } : answer?.handle === handle ? answer.check : { state: 'checking' };

  useEffect(() => {
    if (!valid) return;
    let live = true;
    const id = setTimeout(async () => {
      let next: Check;
      try {
        const existing = await resolveHandle(getAccessToken, handle);
        next = existing ? { state: 'taken', message: `@${handle} is taken` } : { state: 'free' };
      } catch (e) {
        next = { state: 'error', message: errorMessage(e) };
      }
      if (live) setAnswer({ handle, check: next });
    }, 400);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [handle, valid, getAccessToken]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await claimHandle(getAccessToken, handle);
      router.back();
    } catch (e) {
      // The engine is the authority: someone may have taken it since the check.
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="Your @handle" />
      <Text color="textSecondary">Friends on Atlas send you money with this. You can&apos;t change it later.</Text>
      <Field
        prefix="@"
        placeholder="yourname"
        value={raw}
        onChangeText={setRaw}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        maxLength={21}
        accessibilityLabel="Handle"
      />
      {!valid && raw ? (
        <Text variant="caption" color="textSecondary">
          3–20 letters, numbers or underscores.
        </Text>
      ) : check.state === 'checking' ? (
        <Text color="textSecondary">Checking @{handle}…</Text>
      ) : check.state === 'free' ? (
        <Text color="success">@{handle} is available</Text>
      ) : check.state === 'taken' || check.state === 'error' ? (
        <Text color={check.state === 'taken' ? 'textSecondary' : 'danger'}>{check.message}</Text>
      ) : null}
      {saveError ? <Text color="danger">{saveError}</Text> : null}
      <PillButton label={`Claim @${valid ? handle : '…'}`} disabled={check.state !== 'free'} loading={saving} onPress={save} />
    </Screen>
  );
}
