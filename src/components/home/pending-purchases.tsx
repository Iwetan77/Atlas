import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { engineGet, enginePost } from '@/api/client';
import type { ExecutionPlan } from '@/api/contract';
import { useRunIntent } from '@/api/intents';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';

type Waiting = { intentId: string; symbol: string; kind: string };

export function PendingPurchases({ onFinished }: { onFinished: () => void }) {
  const { authenticated, getAccessToken } = useAtlasAuth();
  const run = useRunIntent();
  const [rows, setRows] = useState<Waiting[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!authenticated) { setRows([]); return; }
    try {
      const result = await engineGet<{ intents: Waiting[] }>('/v1/intents/pending', await getAccessToken());
      setRows(result.intents);
    } catch { /* Keep the last waiting cards during a dropped connection. */ }
  }, [authenticated, getAccessToken]);
  useFocusEffect(useCallback(() => {
    void reload();
    const timer = setInterval(() => { void reload(); }, 10000);
    return () => clearInterval(timer);
  }, [reload]));
  const finish = async (row: Waiting) => {
    if (busy) return;
    setBusy(row.intentId); setError(null);
    try {
      const result = await run(async () => enginePost<ExecutionPlan>(
        `/v1/intents/${encodeURIComponent(row.intentId)}/resume`, await getAccessToken(), {},
      ));
      if (result?.state === 'failed') setError(result.error ?? 'This step could not finish. Check your asset balance.');
      if (result) { onFinished(); await reload(); }
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(null); }
  };
  if (!rows.length) return null;
  return <View style={{ gap: 12 }}>
    {rows.map(row => <View key={row.intentId} style={{ gap: 8 }}>
      <Text variant="bodyStrong">{row.kind === 'perp_close' ? 'Cash return waiting' : `${row.symbol} ${row.kind === 'sell' ? 'sale' : 'purchase'} waiting`}</Text>
      <Text color="textSecondary">Finish using the funds already set aside.</Text>
      <PillButton label={busy === row.intentId ? 'Finishing…' : 'Finish'} disabled={busy !== null} onPress={() => { void finish(row); }} />
    </View>)}
    {error ? <Text color="danger">{error}</Text> : null}
  </View>;
}
