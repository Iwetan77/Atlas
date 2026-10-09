import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { Ref } from 'react';
import { type LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse } from 'react-native-svg';

import { bankTransferProgress, type TransactionReceipt } from '@/api/transactions';
import { TransactionLogo, transactionIcon } from '@/components/transactions/transaction-list';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatMoney, HIDDEN } from '@/format/money';
import { colors, lightColors, PaletteContext, radii, spacing, themedStyles } from '@/theme';

type Line = { label: string; value: string };
type Stop = { name: string; detail: string | null; icon: IconName };

// Lines that name where the money went: shown as the route, not again as rows.
const RECIPIENT_LABELS = ['Send to', 'To'];
// Status lines belong on the pill, not in the rows.
const STATUS_LABELS = ['Bank payout', 'Status'];
// The line everything adds up to, set apart at the bottom of the rows.
const TOTAL_LABELS = ['You pay', 'Total from cash'];
// Reference lines, not part of the sum: under the date in the footer. A gas top-up ("Gas top-up (kept
// as SOL)" or "... NEAR)") only appears on a receipt where one actually happened, and it stays in
// the balance.
const isGas = (label: string) => label.startsWith('Gas top-up');
const isFootnote = (label: string) => label === 'Rate' || isGas(label);

const BALANCE: Stop = { name: 'Your Atlas balance', detail: null, icon: 'wallet-outline' };

// "Moniepoint · 5164131897 · ITAFO JOY": the name first, the bank and number under it.
function recipientStop(value: string, icon: IconName): Stop {
  const parts = value.split(' · ');
  return parts.length > 1
    ? { name: parts[parts.length - 1], detail: parts.slice(0, -1).join(' · '), icon }
    : { name: value, detail: null, icon };
}

// Where the money came from and where it went, when the kind of transaction says.
function route(r: TransactionReceipt): { from: Stop; to: Stop } | null {
  const to = r.summary.find((l) => RECIPIENT_LABELS.includes(l.label))?.value;
  const coin = r.symbol || 'coins';
  switch (r.kind) {
    case 'offramp':
      return to ? { from: BALANCE, to: recipientStop(to, 'business-outline') } : null;
    case 'send':
      return to ? { from: BALANCE, to: recipientStop(to, to.startsWith('@') ? 'person-outline' : 'paper-plane-outline') } : null;
    case 'cashlink':
      return { from: BALANCE, to: { name: 'Atlas Link', detail: 'Anyone with the link can claim it', icon: 'link-outline' } };
    case 'withdraw':
      return { from: BALANCE, to: to ? recipientStop(to, 'arrow-up-outline') : { name: `${coin} wallet`, detail: null, icon: 'arrow-up-outline' } };
    case 'onramp':
      return { from: { name: 'Your bank transfer', detail: null, icon: 'card-outline' }, to: BALANCE };
    case 'deposit':
      return { from: { name: `${coin} deposit`, detail: null, icon: 'arrow-down-outline' }, to: BALANCE };
    case 'buy':
      return { from: BALANCE, to: { name: coin, detail: 'Added to your assets', icon: 'sparkles-outline' } };
    case 'sell':
      return { from: { name: coin, detail: null, icon: 'sparkles-outline' }, to: BALANCE };
    case 'earn_deposit':
      return { from: BALANCE, to: { name: 'Savings', detail: r.symbol || null, icon: 'leaf-outline' } };
    case 'earn_withdraw':
      return { from: { name: 'Savings', detail: r.symbol || null, icon: 'leaf-outline' }, to: BALANCE };
    default:
      return null;
  }
}

// The pill under the amount: done, on its way (a cash out says how far), or needs attention.
function status(r: TransactionReceipt): { text: string; icon: IconName } {
  if (r.state === 'filled') return { text: 'Successful', icon: 'checkmark-circle' };
  if (r.state === 'failed') return { text: "Didn't go through", icon: 'alert-circle' };
  if (r.stage === 'validate') return { text: 'Awaiting confirmation', icon: 'time' };
  if (r.kind === 'offramp') return { text: bankTransferProgress(r).title, icon: 'time' };
  if (r.stage === 'sign') return { text: 'Waiting for approval', icon: 'time' };
  return { text: 'On its way', icon: 'time' };
}

export function receiptLongDate(ms: number) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

// A receipt worth keeping and sharing: an Atlas-pink header with the planet's orbits, the amount and
// its status; the route the money took; the confirmed lines adding up to the total; then when, the
// reference and where it came from. The same card is what Share receipt turns into an image.
export function ReceiptCard({
  receipt: r,
  stealth,
  cardRef,
  onLayout,
}: {
  receipt: TransactionReceipt;
  stealth: boolean;
  cardRef?: Ref<View>;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const hide = (value: string) => (stealth ? HIDDEN : value);
  const path = route(r);
  const pill = status(r);
  const recipientLine = path ? r.summary.find((l) => RECIPIENT_LABELS.includes(l.label)) : undefined;
  const rows: Line[] = r.summary.filter(
    (l) => l !== recipientLine && !STATUS_LABELS.includes(l.label) && !isFootnote(l.label),
  );
  const footnotes = r.summary.filter((l) => isFootnote(l.label));
  const total = rows.find((l) => TOTAL_LABELS.includes(l.label)) ?? null;
  const details = rows.filter((l) => l !== total);
  const tone = r.state === 'filled' ? 'success' : r.state === 'failed' ? 'danger' : 'accentPinkTint';

  return (
    <View ref={cardRef} collapsable={false} onLayout={onLayout} style={styles.card}>
      {/* The header is the same pink in both themes, so its white ring and pill use the light
          palette: readable pink and green on white in dark mode too. */}
      <PaletteContext.Provider value={lightColors}>
      <View style={styles.header}>
        <LinearGradient colors={[colors.accentPinkWash, colors.accentPink, colors.accentPinkDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* The planet's orbits, drifting off the corner. */}
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 260" preserveAspectRatio="xMaxYMin slice" pointerEvents="none">
          <Ellipse cx={330} cy={40} rx={150} ry={58} stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={2} fill="none" transform="rotate(-18 330 40)" />
          <Ellipse cx={330} cy={40} rx={215} ry={90} stroke="#FFFFFF" strokeOpacity={0.09} strokeWidth={2} fill="none" transform="rotate(-18 330 40)" />
          <Circle cx={196} cy={74} r={5} fill="#FFFFFF" fillOpacity={0.55} />
          <Circle cx={330} cy={40} r={46} fill="#FFFFFF" fillOpacity={0.07} />
        </Svg>
        <View style={styles.brand}>
          <Image source={require('../../../assets/images/icon.png')} style={styles.mark} contentFit="cover" accessibilityLabel="Atlas" />
          <Text variant="heading" color="textOnAccent">atlas</Text>
          <Text variant="overline" color="textOnAccent" style={styles.brandTag}>Receipt</Text>
        </View>
        <View style={styles.logoRing}>
          {r.symbol?.trim() || r.iconUrl ? (
            <TransactionLogo receipt={r} />
          ) : (
            <Icon name={transactionIcon(r.kind)} size={26} color="accentPinkTint" />
          )}
        </View>
        <Text variant="bodyStrong" color="textOnAccent" style={styles.center}>{r.title}</Text>
        {r.amount ? (
          <Text variant="display" color="textOnAccent" style={styles.center} numberOfLines={1} adjustsFontSizeToFit>
            {hide(formatMoney(r.amount))}
          </Text>
        ) : null}
        <View style={styles.pill}>
          <Icon name={pill.icon} size={15} color={tone} />
          <Text variant="label" color={tone}>{pill.text}</Text>
        </View>
      </View>
      </PaletteContext.Provider>

      {path ? (
        <View style={styles.route}>
          <RouteStop label="From" stop={path.from} />
          <View style={styles.orbitPath}>
            <View style={styles.dots} />
            <View style={styles.traveller} />
          </View>
          <RouteStop label="To" stop={path.to} />
        </View>
      ) : null}

      {details.length || total ? (
        <View style={styles.rows}>
          {details.map((line, n) => (
            <View key={`${line.label}:${n}`} style={styles.row}>
              <Text variant="caption" color="textSecondary" style={styles.rowLabel}>{line.label}</Text>
              <Text variant="label" style={styles.rowValue}>{hide(line.value)}</Text>
            </View>
          ))}
          {total ? (
            <View style={[styles.row, styles.totalRow]}>
              <Text variant="bodyStrong" style={styles.rowLabel}>{total.label}</Text>
              <Text variant="heading" style={styles.rowValue}>{hide(total.value)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerLine}>
          <Icon name="calendar-outline" size={14} color="textSecondary" />
          <Text variant="caption" color="textSecondary">{receiptLongDate(r.createdAtUnixMs)}</Text>
        </View>
        {footnotes.map((line) => (
          <View key={line.label} style={styles.footerLine}>
            <Icon name={isGas(line.label) ? 'flash-outline' : 'swap-horizontal-outline'} size={14} color="textSecondary" />
            <Text variant="caption" color="textSecondary">{line.label} {hide(line.value)}</Text>
          </View>
        ))}
        <View style={styles.footerLine}>
          <Icon name="finger-print-outline" size={14} color="textSecondary" />
          <Text variant="caption" color="textSecondary" style={styles.reference} selectable>{r.id}</Text>
        </View>
        <Text variant="overline" color="accentPinkTint" style={styles.site}>justatlas.xyz</Text>
      </View>
    </View>
  );
}

function RouteStop({ label, stop }: { label: string; stop: Stop }) {
  return (
    <View style={styles.stop}>
      <View style={styles.stopIcon}>
        <Icon name={stop.icon} size={18} color="accentPinkTint" />
      </View>
      <View style={styles.stopText}>
        <Text variant="overline" color="textSecondary">{label}</Text>
        <Text variant="bodyStrong" style={styles.wrap}>{stop.name}</Text>
        {stop.detail ? <Text variant="caption" color="textSecondary" style={styles.wrap}>{stop.detail}</Text> : null}
      </View>
    </View>
  );
}

// Long names, account numbers and references wrap inside the card instead of running past it.
const wrap = Platform.select({ web: { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object, default: {} });

const styles = themedStyles(() => ({
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  brand: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  brandTag: {
    marginLeft: 'auto',
    opacity: 0.85,
  },
  logoRing: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  center: {
    textAlign: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceLight,
    marginTop: spacing.xs,
  },
  route: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stopIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  // A dotted orbit from one stop to the other, with the money on its way along it.
  orbitPath: {
    width: 36,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 0,
    borderLeftWidth: 2,
    borderStyle: 'dotted',
    borderColor: colors.accentPinkTint,
  },
  traveller: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPink,
  },
  rows: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
  },
  rowValue: {
    flexShrink: 1,
    maxWidth: '62%',
    textAlign: 'right',
    ...wrap,
  },
  totalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
  },
  footer: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.bgSurfaceAlt,
  },
  footerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reference: {
    flex: 1,
    minWidth: 0,
    ...wrap,
  },
  site: {
    marginTop: spacing.xs,
  },
  wrap,
}));
