import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import { useRunIntent } from '@/api/intents';
import { executeSend, requestSendQuote, useMe } from '@/api/send';
import { useLiveQuote } from '@/api/use-live-quote';
import { useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { ResultView } from '@/components/result-view';
import { SendReview } from '@/components/send/send-review';
import { BackHeader } from '@/components/ui/back-header';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { SpendableCard } from '@/components/send/spendable-card';
import { formatMoney } from '@/format/money';
import { claimUrl, keepLinkKey, newLinkKey, publicLinkLabel } from '@/funding/link-key';
import { useSettings } from '@/settings/context';
import { friendlyTxError } from '@/signing/errors';
import { colors, radii, spacing, themedStyles } from '@/theme';
import { Icon } from '@/components/ui/icon';
import { shareLink } from '@/components/share/share-link';
import { useBackToWithdraw } from '@/funding/withdraw';

const MESSAGE_MAX = 80;

type Phase = { kind: 'edit' } | { kind: 'sending' } | { kind: 'done'; url: string; amount: string } | { kind: 'failed'; message: string };

// A prefunded link: whoever opens it claims the money on a web page, no app needed.
export default function CashLinkScreen() {
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const runIntent = useRunIntent();
  const { me } = useMe();
  const creating = useRef(false);

  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });
  useBackToWithdraw(phase.kind === 'done');
  const [copied, setCopied] = useState(false);
  // One secret per link; its address is where the money waits until someone claims it.
  const [key] = useState(newLinkKey);
  const live = claimUrl(key) !== null;

  const value = Number(amount) || 0;
  const note = message.trim();

  const request = useCallback(
    () =>
      requestSendQuote(getAccessToken, {
        destination: { type: 'cashlink', escrow: key.escrow, ...(note ? { message: note } : {}) },
        amount: { amount: value.toFixed(2), currency: displayCurrency },
      }),
    [getAccessToken, key.escrow, note, value, displayCurrency],
  );
  const { quote, quoting, error, secondsLeft, reload } = useLiveQuote(
    value > 0 && live ? request : null,
    phase.kind === 'edit',
  );

  const create = async () => {
    if (!quote || creating.current) return;
    const url = claimUrl(key);
    if (!url) return;
    creating.current = true;
    setPhase({ kind: 'sending' });
    try {
      // Kept on this phone before any money moves, so it can always be taken back.
      await keepLinkKey(key);
      const final = await runIntent(() => executeSend(getAccessToken, quote.quoteId));
      if (!final) setPhase({ kind: 'edit' });
      else if (final.state === 'filled') setPhase({ kind: 'done', url, amount: formatMoney(quote.receive) });
      else setPhase({ kind: 'failed', message: final.error ?? 'The link could not be created.' });
    } catch (e) {
      setPhase({ kind: 'failed', message: friendlyTxError(e) });
    } finally { creating.current = false; }
  };

  if (phase.kind === 'done') {
    const sender = me?.handle ? '@' + me.handle : 'Your friend';
    const caption = `${sender} is inviting you to Atlas with ${phase.amount}${note ? ': ' + note : '.'} Open this private link to claim your gift.`;
    return (
      <ResultView title="Your gift is ready" subtitle="Share this private link with the person you’re sending it to.">
        <Card style={styles.gift}>
          <View style={styles.giftIcon}><Icon name="gift-outline" color="accentPink" size={30} /></View>
          <Text variant="bodyStrong">{sender} invites you to Atlas</Text>
          <Text variant="display">{phase.amount}</Text>
          {note ? <Text color="textSecondary" style={styles.center}>{note}</Text> : null}
          <View style={styles.link}><Icon name="link-outline" color="accentPink" size={16} />
            <Text variant="caption" numberOfLines={1} style={styles.linkLabel}>{publicLinkLabel(phase.url)}</Text>
          </View>
          <Text variant="caption" color="textSecondary" style={styles.center}>Your gift is funded and waiting to be claimed.</Text>
        </Card>
        <PillButton label={copied ? 'Copied invitation' : 'Share invitation'} icon="share-outline" onPress={async () => {
          const result = await shareLink(caption, phase.url, sender + ' invites you to Atlas');
          if (result === 'copied') setCopied(true);
        }} />
        <PillButton
          label={copied ? 'Copied' : 'Copy private link'}
          icon={copied ? 'checkmark-circle' : 'copy-outline'}
          tone={copied ? 'success' : 'secondary'}
          onPress={async () => {
            await Clipboard.setStringAsync(phase.url);
            setCopied(true);
          }}
        />
        <PillButton label="Done" tone="secondary" onPress={() => router.navigate('/')} />
      </ResultView>
    );
  }

  return (
    <Screen>
      <BackHeader title="Atlas Link" />
      <SpendableCard />
      <Text color="textSecondary">Send money with just a link. They open it and claim it, no app needed.</Text>
      <AmountInput label="Link amount" value={amount} onChange={setAmount} currency={displayCurrency} />
      <Field
        placeholder="Add a note (optional)"
        value={message}
        onChangeText={(t) => setMessage(t.slice(0, MESSAGE_MAX))}
        maxLength={MESSAGE_MAX}
        accessibilityLabel="Note for the link"
      />
      {live ? (
        <SendReview quote={quote} quoting={quoting} error={error} secondsLeft={secondsLeft} onReload={phase.kind === 'edit' ? reload : undefined} />
      ) : (
        <Text color="textSecondary">Atlas Links open on the Atlas website, which goes live soon.</Text>
      )}
      {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
      <PillButton
        label="Create link"
        icon="link-outline"
        disabled={!live || !quote || quoting}
        loading={phase.kind === 'sending'}
        onPress={create}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  gift: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  giftIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accentPinkMuted, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  link: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.bgBase, borderRadius: radii.pill },
  linkLabel: { flexShrink: 1 },
  cta: {
    marginTop: spacing.sm,
  },
}));
