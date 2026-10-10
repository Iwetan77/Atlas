import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { engineGet, enginePost } from '@/api/client';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { NotificationDeviceControl } from '@/notifications/device-control';
import { colors, radii, spacing, themedStyles } from '@/theme';

type Alert = { id: string; targetUsd: string; direction: 'above' | 'below'; state: string };
export function AssetPriceAlert({ assetId, symbol, visible, onClose }: {
  assetId: string; symbol: string; visible: boolean; onClose: () => void;
}) {
  const { userId, getAccessToken } = useAtlasAuth();
  const insets = useSafeAreaInsets();
  const [target, setTarget] = useState('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const generation = useRef(0);
  const working = useRef(false);
  useEffect(() => {
    const ticket = ++generation.current;
    if (!visible || !userId) return;
    let live = true;
    void Promise.resolve().then(() => {
      if (!live) return null;
      setTarget(''); setAlerts([]); setProblem(null); setSaved(null); setLoading(true);
      return getAccessToken();
    }).then(token => token === null || !live ? { alerts: [] } : engineGet<{ alerts: Alert[] }>(
      '/v1/price-alerts?assetId=' + encodeURIComponent(assetId), token, { timeoutMs: 15_000 },
    )).then(result => { if (live && generation.current === ticket) setAlerts(result.alerts); })
      .catch(e => { if (live && generation.current === ticket) setProblem(errorMessage(e)); })
      .finally(() => { if (live && generation.current === ticket) setLoading(false); });
    return () => { live = false; };
  }, [assetId, visible, userId, getAccessToken]);
  const save = async () => {
    if (working.current) return;
    const value = Number(target.trim());
    if (!Number.isFinite(value) || value < 1e-12 || value > 1e12) { setProblem('Enter a positive USD price.'); return; }
    const ticket = generation.current;
    working.current = true; setBusy(true); setProblem(null); setSaved(null);
    try {
      const result = await enginePost<{ alert: Alert }>('/v1/price-alerts', await getAccessToken(),
        { assetId, targetUsd: String(value) }, { timeoutMs: 20_000 });
      if (generation.current !== ticket) return;
      setAlerts(previous => [result.alert, ...previous.filter(a => a.id !== result.alert.id)]);
      setSaved('Alert set. We’ll let you know when ' + symbol + ' reaches $' + result.alert.targetUsd + ' or ' + (result.alert.direction === 'above' ? 'higher.' : 'lower.'));
      setTarget('');
    } catch (e) { if (generation.current === ticket) setProblem(errorMessage(e)); }
    finally { working.current = false; setBusy(false); }
  };
  const remove = async (id: string) => {
    if (working.current) return;
    const ticket = generation.current;
    working.current = true; setBusy(true); setProblem(null);
    try {
      await enginePost('/v1/price-alerts/' + encodeURIComponent(id) + '/cancel', await getAccessToken(), {}, { timeoutMs: 15_000 });
      if (generation.current === ticket) setAlerts(previous => previous.filter(a => a.id !== id));
    } catch (e) { if (generation.current === ticket) setProblem(errorMessage(e)); }
    finally { working.current = false; setBusy(false); }
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}><View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}><View style={styles.intro}>
          <Text variant="title">Follow {symbol}</Text><Text color="textSecondary">Your next move, at your price.</Text>
        </View><Pressable accessibilityRole="button" accessibilityLabel="Close price alerts" onPress={onClose} style={styles.close}>
          <Icon name="close" color="textSecondary" size={22} />
        </Pressable></View>
        <View style={styles.inputWrap}><Text color="textSecondary" variant="caption">NOTIFY ME AT · USD</Text>
          <View style={styles.amount}><Text variant="title" color="textSecondary">$</Text>
            <TextInput value={target} onChangeText={setTarget} placeholder="96.00" placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad" returnKeyType="done" onSubmitEditing={() => void save()} editable={!busy}
              accessibilityLabel="Target price in US dollars" style={styles.input} />
          </View>
        </View>
        <Text variant="caption" color="textSecondary">One alert when the price reaches your target. Checks run on our server; delivery may be delayed while it wakes or market data refreshes.</Text>
        <PillButton label="Set price alert" icon="notifications-outline" loading={busy} onPress={() => void save()} />
        {saved ? <Text variant="caption" color="success" accessibilityRole="alert">{saved}</Text> : null}
        {problem ? <Text variant="caption" color="danger" accessibilityRole="alert">{problem}</Text> : null}
        <View style={styles.device}><NotificationDeviceControl /></View>
        {loading ? <ActivityIndicator color={colors.accentPink} /> : null}
        {alerts.filter(a => a.state === 'active' || a.state === 'firing').length ? <View style={styles.alerts}>
          <Text variant="label" color="textSecondary">YOUR ACTIVE ALERTS</Text>
          {alerts.filter(a => a.state === 'active' || a.state === 'firing').map(a => <View key={a.id} style={styles.row}>
            <Icon name="notifications-outline" size={18} color="accentPinkTint" />
            <Text variant="bodyStrong" style={styles.target}>{'$' + a.targetUsd} <Text variant="caption" color="textSecondary">or {a.direction === 'above' ? 'higher' : 'lower'}</Text></Text>
            <Pressable accessibilityRole="button" accessibilityLabel={'Remove $' + a.targetUsd + ' alert'} onPress={() => void remove(a.id)}
              disabled={busy || a.state === 'firing'} style={styles.close}><Icon name="close" color="textSecondary" size={18} /></Pressable>
          </View>)}
        </View> : null}
      </ScrollView>
    </View></View>
  </Modal>;
}
const styles = themedStyles(() => ({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: spacing.lg },
  sheet: { width: '100%', maxWidth: 440, maxHeight: '92%', alignSelf: 'center', backgroundColor: colors.bgSurface, borderRadius: radii.lg },
  content: { padding: spacing.lg, gap: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  intro: { flex: 1, gap: spacing.xs }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { backgroundColor: colors.bgBase, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
  amount: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, color: colors.textPrimary, fontSize: 34, fontWeight: '600', minHeight: 54, paddingVertical: spacing.xs },
  device: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  alerts: { gap: spacing.sm }, row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }, target: { flex: 1 },
}));
