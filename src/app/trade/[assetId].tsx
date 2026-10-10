import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useAssetDetail } from '@/api/asset-detail';
import { AssetShare } from '@/components/trade/asset-share';
import { AssetPriceAlert } from '@/notifications/asset-price-alert';
import { useBalance } from '@/api/balance';
import type { IntentStage, Quote, TradeSide } from '@/api/contract';
import { useRunIntent } from '@/api/intents';
import { executeQuote, requestQuote } from '@/api/markets';
import { useSpotPositions } from '@/api/positions';
import { useMe } from '@/api/send';
import { useLiveQuote } from '@/api/use-live-quote';
import { useAtlasAuth } from '@/auth/context';
import { AmountInput } from '@/components/amount-input';
import { MemeCard } from '@/components/home/meme-card';
import { MoneyError } from '@/components/money-error';
import { ResultView } from '@/components/result-view';
import { AssetMarketStats } from '@/components/trade/asset-market-stats';
import { AssetAvatar } from '@/components/trade/asset-avatar';
import { PriceChart } from '@/components/trade/price-chart';
import { BackHeader } from '@/components/ui/back-header';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatMoney, formatPrice, formatTokenAmount } from '@/format/money';
import { useSettings } from '@/settings/context';
import { friendlyTxError } from '@/signing/errors';
import { colors, radii, spacing, themedStyles } from '@/theme';
import { TradeLayout } from '@/components/web/trade-layout';
import { QuoteTimer } from '@/components/quote-timer';

const POSITION_POLL_MS = 10_000;

type Phase =
  | { kind: 'edit' }
  | { kind: 'preparing' }
  | { kind: 'settling'; stage?: IntentStage }
  | { kind: 'done'; quote: Quote }
  | { kind: 'failed'; message: string };

export default function AssetTradeScreen() {
  const params = useLocalSearchParams<{
    assetId: string;
    symbol: string;
    name: string;
    price: string;
    iconUrl: string;
    change: string;
    verified: string;
    tradeable: string;
    kind: string;
  }>();
  // A Base coin's id is "base:<address>": the warning shows the address itself.
  const address = params.assetId.replace(/^base:/, '');
  const { getAccessToken } = useAtlasAuth();
  const { displayCurrency, stealthMode } = useSettings();
  const runIntent = useRunIntent();
  const { asset: liveAsset } = useAssetDetail(params.assetId, displayCurrency);
  const asset = liveAsset ?? (params.name && params.symbol && Number(params.price) > 0 ? {
    assetId: params.assetId, name: params.name, symbol: params.symbol,
    price: { amount: params.price, currency: displayCurrency }, iconUrl: params.iconUrl || null,
    kind: (params.kind || 'crypto') as import('@/api/contract').AssetKind,
    change24hPct: params.change || null, verified: params.verified !== 'no', tradeable: params.tradeable !== 'no',
  } : null);
  const [shareOpen, setShareOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const symbol = asset?.symbol ?? params.symbol ?? 'asset';


  const [side, setSide] = useState<TradeSide>('buy');
  const [amount, setAmount] = useState('');
  // Max on the sell side: the whole holding, not whatever its value rounds to.
  const [all, setAll] = useState(false);
  const holdings = useBalance().data?.holdings;
  const held = holdings?.find((h) => h.assetId === params.assetId && (h.location ?? 'wallet') === 'wallet');
  const sellAll = side === 'sell' && all;

  // What they hold of this coin, as its share card, kept live while the screen is open.
  const { me } = useMe();
  const { data: positions, reload: reloadPositions } = useSpotPositions();
  const position = positions?.find((p) => p.assetId === params.assetId && Number(p.amount) > 0);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const id = setInterval(reloadPositions, POSITION_POLL_MS);
    return () => clearInterval(id);
  }, [reloadPositions]);
  const refreshPosition = async () => {
    setRefreshing(true);
    try {
      await reloadPositions();
    } finally {
      setRefreshing(false);
    }
  };
  const editAmount = (raw: string) => {
    setAll(false);
    setAmount(raw);
  };
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });

  const value = Number(amount) || 0;
  const change = asset?.change24hPct ? Number(asset.change24hPct) : null;

  const request = useCallback(
    () =>
      requestQuote(getAccessToken, {
        assetId: params.assetId,
        side,
        amount: { amount: value.toFixed(2), currency: displayCurrency },
        ...(sellAll ? { all: true } : {}),
      }),
    [getAccessToken, params.assetId, side, value, displayCurrency, sellAll],
  );
  const { quote, error: quoteError, quoting, secondsLeft, reload, clear } = useLiveQuote(
    value > 0 ? request : null,
    phase.kind === 'edit',
  );

  const trade = async () => {
    if (!quote) return;
    setPhase({ kind: 'preparing' });
    try {
      const final = await runIntent(
        () => executeQuote(getAccessToken, quote.quoteId),
        () => setPhase({ kind: 'settling' }),
        (status) => setPhase({ kind: 'settling', stage: status.stage }),
      );
      if (!final) setPhase({ kind: 'edit' });
      else if (final.state === 'filled') setPhase({ kind: 'done', quote });
      else setPhase({ kind: 'failed', message: final.error ?? 'The trade did not go through.' });
    } catch (e) {
      setPhase({ kind: 'failed', message: friendlyTxError(e) });
    }
  };

  if (phase.kind === 'done') {
    const q = phase.quote;
    const got = q.side === 'buy' ? q.receive : q.pay;
    return (
      <ResultView
        title={`${q.side === 'buy' ? 'You bought' : 'You sold'} ${formatTokenAmount(got.amount, got.symbol)}`}
        subtitle={
          q.side === 'buy'
            ? `${formatMoney(q.pay.value)} from your balance`
            : `${formatMoney(q.receive.value)} added to your balance`
        }>
        <PillButton label="Done" onPress={() => router.navigate('/')} />
        <PillButton
          label="Trade again"
          tone="secondary"
          onPress={() => {
            setAmount('');
            setAll(false);
            clear();
            setPhase({ kind: 'edit' });
          }}
        />
      </ResultView>
    );
  }

  return (
    <Screen>
      <TradeLayout market={<>
      <View style={styles.toolbar}>
        <BackHeader />
        <View style={styles.tools}>
          <Pressable accessibilityRole="button" accessibilityLabel="Set price alert" disabled={!asset}
            onPress={() => setAlertOpen(true)} style={styles.tool}>
            <Icon name="notifications-outline" size={20} color="accentPink" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Share asset" disabled={!asset}
            onPress={() => setShareOpen(true)} style={styles.tool}>
            <Icon name="share-social-outline" size={20} color="accentPink" />
          </Pressable>
        </View>
      </View>
      {asset ? <>
        <AssetShare asset={asset} visible={shareOpen} onClose={() => setShareOpen(false)} />
        <AssetPriceAlert assetId={asset.assetId} symbol={asset.symbol} visible={alertOpen} onClose={() => setAlertOpen(false)} />
      </> : null}

      <View style={styles.assetHeader}>
        <AssetAvatar symbol={symbol} iconUrl={asset?.iconUrl ?? params.iconUrl ?? null} size={52} />
        <View style={styles.assetText}>
          <Text variant="heading">{asset?.name ?? params.name ?? 'Loading asset…'}</Text>
          <Text color="textSecondary">
            {asset ? formatPrice(asset.price) : 'Loading price…'}
            {change === null ? '' : '  '}
            {change === null ? null : (
              <Text color={change >= 0 ? 'success' : 'danger'}>
                {change >= 0 ? '+' : ''}
                {change.toFixed(2)}%
              </Text>
            )}
          </Text>
        </View>
      </View>

      {position ? (
        <View style={styles.position}>
          <Text variant="overline" color="textSecondary">
            Your position
          </Text>
          <MemeCard
            position={position}
            handle={me?.handle ?? null}
            stealth={stealthMode}
            onRefresh={refreshPosition}
            refreshing={refreshing}
          />
        </View>
      ) : null}
      {asset?.verified === false ? (
        <View style={styles.warning}>
          <Icon name="warning-outline" size={18} color="danger" />
          <Text variant="caption" color="danger" style={styles.flex}>
            Unverified token. Anyone can create a token with any name or logo, so make sure this address is the
            one you meant: {address.slice(0, 6)}…{address.slice(-6)}
          </Text>
        </View>
      ) : null}

      <PriceChart assetId={params.assetId} />
      {asset?.kind !== 'stock' ? <AssetMarketStats assetId={params.assetId} /> : null}
      </>} ticket={<>

      {asset?.tradeable === false ? (
        <View style={styles.soon}>
          <Icon name="time-outline" size={18} color="accentPinkTint" />
          <Text color="textSecondary" style={styles.flex}>
            Buying {symbol} from your balance is coming soon. You can follow its price here meanwhile.
          </Text>
        </View>
      ) : null}

      <View style={styles.segment}>
        {(['buy', 'sell'] as TradeSide[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSide(s)}
            accessibilityRole="tab"
            accessibilityState={{ selected: side === s }}
            style={[styles.segmentItem, side === s && styles.segmentActive]}>
            <Text variant="bodyStrong" color={side === s ? 'textOnAccent' : 'textSecondary'}>
              {s === 'buy' ? 'Buy' : 'Sell'}
            </Text>
          </Pressable>
        ))}
      </View>

      <AmountInput
        label={side === 'buy' ? 'You spend' : 'You sell (value)'}
        value={amount}
        onChange={editAmount}
        currency={displayCurrency}
        onMax={
          side === 'sell' && held && Number(held.amount) > 0
            ? () => {
                setAmount(held.value.amount);
                setAll(true);
              }
            : undefined
        }
        maxActive={sellAll}
        percentOf={side === 'sell' && held ? held.value.amount : undefined}
      />

      {quote ? (
        <Card variant="outlined" style={styles.quote}>
          <QuoteRow
            label="You pay"
            value={side === 'buy' ? formatMoney(quote.pay.value) : formatTokenAmount(quote.pay.amount, quote.pay.symbol)}
          />
          <QuoteRow
            label="You get"
            value={side === 'buy' ? formatTokenAmount(quote.receive.amount, quote.receive.symbol) : formatMoney(quote.receive.value)}
            strong
          />
          <QuoteRow label="Price" value={`${formatPrice(quote.price)} / ${symbol}`} />
          <QuoteRow label="Fee" value={formatMoney(quote.fee)} />
          {quote.funding ? (
            <View style={styles.funding}>
              <Icon name="information-circle-outline" size={16} color="textSecondary" />
              <Text variant="caption" color="textSecondary" style={styles.fundingText}>
                Includes a {formatMoney(quote.funding.fee)} network fee. Takes about 30 seconds.
              </Text>
            </View>
          ) : null}
          <QuoteTimer
            text={quoting ? 'Updating price…' : `Price held for ${secondsLeft}s`}
            onReload={phase.kind === 'edit' ? reload : undefined}
            busy={quoting}
          />
        </Card>
      ) : quoting ? (
        <Busy text="Getting the best price…" />
      ) : quoteError ? (
        <MoneyError message={quoteError} />
      ) : null}

      {phase.kind === 'failed' ? <Text color="danger">{phase.message}</Text> : null}
      {phase.kind === 'settling' ? (
        <Busy
          text={
            phase.stage === 'fund'
              ? 'Getting your money ready… about 30 seconds'
              : `${side === 'buy' ? 'Buying' : 'Selling'} ${symbol}… this usually takes a few seconds`
          }
        />
      ) : null}

      <PillButton
        label={`${side === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
        disabled={!asset || asset.tradeable === false || !quote || quoting || phase.kind === 'settling'}
        loading={phase.kind === 'preparing' || phase.kind === 'settling'}
        onPress={trade}
      />
      </>} />
    </Screen>
  );
}

function QuoteRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.quoteRow}>
      <Text color="textSecondary">{label}</Text>
      <Text variant={strong ? 'heading' : 'bodyStrong'}>{value}</Text>
    </View>
  );
}

function Busy({ text }: { text: string }) {
  return (
    <View style={styles.busy}>
      <ActivityIndicator color={colors.accentPink} />
      <Text color="textSecondary">{text}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  tools: { flexDirection: 'row', gap: spacing.sm },
  tool: { width: 40, height: 40, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentPinkDim },

  position: {
    gap: spacing.sm,
  },
  soon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.bgSurface,
  },
  funding: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  fundingText: {
    flex: 1,
  },
  warning: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.dangerDim,
  },
  flex: {
    flex: 1,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  assetText: {
    flex: 1,
    gap: spacing.xxs,
  },
  segment: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSurface,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  segmentActive: {
    backgroundColor: colors.accentPink,
  },
  quote: {
    gap: spacing.md,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
  },
  busy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
}));
