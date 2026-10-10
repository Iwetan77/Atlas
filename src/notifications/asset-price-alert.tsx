import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { engineGet, enginePost } from '@/api/client';
import type { Money } from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { currencySymbol, formatPrice } from '@/format/money';
import { NotificationDeviceControl } from '@/notifications/device-control';
import { useSettings } from '@/settings/context';
import { colors, fonts, radii, spacing, themedStyles } from '@/theme';

type Alert = { id: string; targetUsd: string; target?: Money; displayTarget?: Money; direction: 'above' | 'below'; state: string };
const alertMoney = (alert: Alert): Money => alert.displayTarget ?? alert.target ?? { amount: alert.targetUsd, currency: 'USD' };
export function AssetPriceAlert({ assetId, symbol, name, iconUrl, price, visible, onClose }: {
  assetId: string; symbol: string; name?: string; iconUrl?: string | null; price?: Money; visible: boolean; onClose: () => void;
}) {
  const { userId, getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const insets = useSafeAreaInsets();
  const [target, setTarget] = useState('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const generation = useRef(0);
  const working = useRef(false);
  const value = Number(target.trim());
  const current = price?.currency === displayCurrency ? Number(price.amount) : null;
  const higher = current !== null && Number.isFinite(value) && value > 0 ? value >= current : null;
  useEffect(() => {
    const ticket = ++generation.current;
    if (!visible || !userId) return;
    let live = true;
    void Promise.resolve().then(() => {
      if (!live) return null;
      setTarget(''); setAlerts([]); setProblem(null); setSaved(null); setLoading(true);
      return getAccessToken();
    }).then(token => token === null || !live ? { alerts: [] } : engineGet<{ alerts: Alert[] }>(
      '/v1/price-alerts?assetId=' + encodeURIComponent(assetId) + '&currency=' + displayCurrency, token, { timeoutMs: 15_000 },
    )).then(result => { if (live && generation.current === ticket) setAlerts(result.alerts); })
      .catch(e => { if (live && generation.current === ticket) setProblem(errorMessage(e)); })
      .finally(() => { if (live && generation.current === ticket) setLoading(false); });
    return () => { live = false; };
  }, [assetId, displayCurrency, visible, userId, getAccessToken]);
  const save = async () => {
    if (working.current) return;
    if (!Number.isFinite(value) || value < 1e-12 || value > 1e12) { setProblem('Enter a positive ' + displayCurrency + ' price.'); return; }
    const ticket = generation.current;
    working.current = true; setBusy(true); setProblem(null); setSaved(null);
    try {
      const result = await enginePost<{ alert: Alert }>('/v1/price-alerts', await getAccessToken(),
        { assetId, target: { amount: String(value), currency: displayCurrency } }, { timeoutMs: 20_000 });
      if (generation.current !== ticket) return;
      setAlerts(previous => [result.alert, ...previous.filter(a => a.id !== result.alert.id)]);
      setSaved('Alert set for ' + formatPrice(alertMoney(result.alert)) + ' or ' + (result.alert.direction === 'above' ? 'higher.' : 'lower.'));
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
    <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, spacing.lg), paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.heading}><View style={styles.intro}>
            <Text variant="heading">Price alert</Text><Text variant="caption" color="textSecondary">Your price. We’ll keep an eye on it.</Text>
          </View><Pressable accessibilityRole="button" accessibilityLabel="Close price alerts" onPress={onClose} style={styles.close}>
            <Icon name="close" color="textSecondary" size={22} />
          </Pressable></View>
          <View style={styles.asset}><AssetAvatar symbol={symbol} iconUrl={iconUrl ?? null} size={44} />
            <View style={styles.intro}><Text variant="bodyStrong" numberOfLines={1}>{name ?? symbol}</Text>
              <Text variant="caption" color="textSecondary">{symbol}</Text></View>
            {price?.currency === displayCurrency ? <View style={styles.current}><Text variant="caption" color="textSecondary">CURRENT PRICE</Text>
              <Text variant="label">{formatPrice(price)}</Text></View> : null}
          </View>
          <View style={styles.inputWrap}><View style={styles.inputHeading}>
            <Text variant="label" color="textSecondary">Notify me at</Text><View style={styles.currency}><Text variant="label" color="accentPinkTint">{displayCurrency}</Text></View>
          </View>
            <View style={styles.amount}><Text style={styles.symbol} color="textSecondary">{currencySymbol(displayCurrency)}</Text>
              <TextInput value={target} onChangeText={raw => setTarget(raw.replace(/,/g, '').replace(/[^0-9.]/g, ''))}
                placeholder="0.00" placeholderTextColor={colors.textDisabled} keyboardType="decimal-pad" returnKeyType="done"
                onSubmitEditing={() => void save()} editable={!busy} accessibilityLabel={'Target price in ' + displayCurrency} style={styles.input} />
            </View>
            <View style={styles.inputHint}><Icon name={higher === null ? 'notifications-outline' : higher ? 'trending-up-outline' : 'trending-down-outline'} size={16} color="accentPinkTint" />
              <Text variant="caption" color="textSecondary" style={styles.hintText}>{higher === null ? 'Set a price above or below today’s price' : higher ? 'Notify me when the price rises to this target' : 'Notify me when the price falls to this target'}</Text></View>
          </View>
          <PillButton label={'Create ' + symbol + ' alert'} icon="notifications-outline" loading={busy} onPress={() => void save()} />
          {saved ? <View style={styles.success}><Icon name="checkmark-circle" color="success" size={20} />
            <Text variant="caption" color="success" style={styles.intro} accessibilityRole="alert">{saved}</Text></View> : null}
          {problem ? <Text variant="caption" color="danger" accessibilityRole="alert">{problem}</Text> : null}
          <Text variant="caption" color="textSecondary">One notification when your target is reached. Your alert stays in {displayCurrency}; delivery depends on fresh prices and device permissions.</Text>
          <View style={styles.device}><NotificationDeviceControl /></View>
          {loading ? <ActivityIndicator color={colors.accentPink} /> : null}
          {alerts.filter(a => a.state === 'active' || a.state === 'firing').length ? <View style={styles.alerts}>
            <Text variant="label" color="textSecondary">YOUR ALERTS</Text>
            {alerts.filter(a => a.state === 'active' || a.state === 'firing').map(a => <View key={a.id} style={styles.row}>
              <View style={styles.alertIcon}><Icon name={a.direction === 'above' ? 'trending-up-outline' : 'trending-down-outline'} size={20} color="accentPinkTint" /></View>
              <View style={styles.intro}><Text variant="bodyStrong">{formatPrice(alertMoney(a))}</Text>
                <Text variant="caption" color="textSecondary">{a.state === 'firing' ? 'Sending your alert' : a.direction === 'above' ? 'At this price or higher' : 'At this price or lower'}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={'Remove ' + formatPrice(alertMoney(a)) + ' alert'} onPress={() => void remove(a.id)}
                disabled={busy || a.state === 'firing'} style={styles.close}><Icon name="close" color="textSecondary" size={18} /></Pressable>
            </View>)}
          </View> : null}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const styles = themedStyles(() => ({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: spacing.lg },
  sheet: { width: '100%', maxWidth: 440, maxHeight: '100%', alignSelf: 'center', backgroundColor: colors.bgSurface, borderRadius: radii.lg, overflow: 'hidden' },
  content: { padding: spacing.lg, gap: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  intro: { flex: 1, gap: spacing.xs },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  asset: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  current: { alignItems: 'flex-end', gap: spacing.xs },
  inputWrap: { backgroundColor: colors.bgBase, borderRadius: radii.md, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  inputHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  currency: { backgroundColor: colors.accentPinkDim, borderRadius: radii.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  amount: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  symbol: { fontFamily: fonts.displaySemi, fontSize: 29, lineHeight: 42 },
  input: { flex: 1, color: colors.textPrimary, fontFamily: fonts.display, fontSize: 36, minHeight: 52, paddingVertical: spacing.xs },
  inputHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hintText: { flex: 1 },
  success: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.successDim, borderRadius: radii.sm, padding: spacing.md },
  device: { paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  alerts: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.bgBase, borderRadius: radii.md, paddingLeft: spacing.md },
  alertIcon: { backgroundColor: colors.accentPinkDim, width: 36, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
}));
