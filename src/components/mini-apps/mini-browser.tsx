// A mini app inside Atlas: the dapp runs in a WebView with the Atlas wallet injected (an EIP-1193
// wallet on Base, a Wallet Standard wallet on Solana). Reads go straight to the chain; every
// signature or transaction waits for the user's yes on an Atlas sheet first. A Solana transaction
// is simulated first, and never signed if someone else pays its fee or it would fail.
import { useEmbeddedEthereumWallet, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { getBase58Decoder } from '@solana/kit';
import { Buffer } from 'buffer';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { formatEther, hexToString, isHex, numberToHex } from 'viem';
import { base } from 'viem/chains';

import { useAtlasAuth } from '@/auth/context';
import { type MiniApp, onAppSite } from '@/components/mini-apps/catalog';
import { PROVIDER_SCRIPT, READ_METHODS, SIGN_METHODS } from '@/components/mini-apps/provider-script';
import { SOLANA_PROVIDER_SCRIPT } from '@/components/mini-apps/solana-provider-script';
import { looksLikeTransaction, reviewSolanaTransaction, type SolanaReview } from '@/components/mini-apps/solana-review';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { evmClient, MaybeSent, solanaConnection } from '@/signing/chains';
import { friendlyTxError } from '@/signing/errors';
import { consumePin, type PinAction } from '@/api/pin';
import { PinPad } from '@/security/pin-pad';
import { authorizePin } from '@/api/pin';
import { colors, maxContentWidth, radii, spacing, themedStyles } from '@/theme';

type Request = { id: number; method: string; params: any };
type RpcError = { code: number; message: string };
// A Solana transaction's review: still running, done, or couldn't be done.
type Review = 'checking' | SolanaReview;

const BASE_CHAIN_ID = '0x2105';
const baseClient = evmClient(base);
const SOLANA_SIGN = new Set(['solana:signMessage', 'solana:signTransaction', 'solana:signAndSendTransaction']);

export function MiniBrowser({ app }: { app: MiniApp }) {
  const insets = useSafeAreaInsets();
  const { wallets, getAccessToken } = useAtlasAuth();
  const [pinReset, setPinReset] = useState(0);
  const processing = useRef(false);
  const eth = useEmbeddedEthereumWallet();
  const sol = useEmbeddedSolanaWallet();
  const web = useRef<WebView>(null);
  const activeRequest = useRef<Request | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; activeRequest.current = null; }; }, []);
  const [asking, setAsking] = useState<Request | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const onSolana = app.chain === 'solana';
  const address = wallets.base;

  const reply = (id: number, result: unknown, error?: RpcError) => {
    web.current?.injectJavaScript(
      `window.__atlasReply(${id}, ${JSON.stringify(result ?? null)}, ${JSON.stringify(error ?? null)}); true;`,
    );
  };

  const close = () => {
    activeRequest.current = null;
    setAsking(null);
    setReview(null);
    setProblem(null);
  };

  const onSolanaMessage = async (request: Request) => {
    const { id, method, params } = request;
    const owner = wallets.solana;
    if (method === 'standard:connect') {
      return owner ? reply(id, { address: owner }) : reply(id, null, { code: 4001, message: 'Your Solana wallet is still being set up' });
    }
    if (method === 'standard:disconnect') return reply(id, null);
    if (!SOLANA_SIGN.has(method)) return reply(id, null, { code: 4200, message: `${method} isn't supported in Atlas mini apps` });
    if (!owner) return reply(id, null, { code: 4001, message: 'Your Solana wallet is still being set up' });
    if (activeRequest.current) return reply(id, null, { code: 4001, message: 'Finish the current request first' });
    activeRequest.current = request; setPinReset((n) => n+1);
    setProblem(null);
    setAsking(request);
    if (method === 'solana:signMessage') return;
    setReview('checking');
    try {
      setReview(await reviewSolanaTransaction(Buffer.from(String(params?.transaction ?? ''), 'base64'), owner));
    } catch {
      setReview({ transaction: null as never, changes: [], fee: '0', unknown: [], refusal: 'Atlas couldn’t check what this transaction does, so it won’t sign it. Try again in a moment.' });
    }
  };

  const onMessage = async (event: WebViewMessageEvent) => {
    let request: Request;
    try {
      request = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (onSolana) return onSolanaMessage(request);
    const { id, method, params } = request;
    try {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return reply(id, address ? [address] : []);
      if (method === 'eth_chainId') return reply(id, BASE_CHAIN_ID);
      // EIP-2255 permissions: the only one there is to grant is the account list.
      if (method === 'wallet_requestPermissions' || method === 'wallet_getPermissions') {
        return reply(id, address ? [{ parentCapability: 'eth_accounts', caveats: [] }] : []);
      }
      if (method === 'wallet_revokePermissions') return reply(id, null);
      // EIP-5792: no batching or paymaster capabilities to advertise.
      if (method === 'wallet_getCapabilities') return reply(id, {});
      if (method === 'web3_clientVersion') return reply(id, 'Atlas');
      if (method === 'net_version') return reply(id, String(base.id));
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') {
        const wanted = (params[0] as { chainId?: string } | undefined)?.chainId?.toLowerCase();
        return wanted === BASE_CHAIN_ID
          ? reply(id, null)
          : reply(id, null, { code: 4902, message: 'Atlas mini apps run on Base' });
      }
      if (READ_METHODS.has(method)) {
        return reply(id, await baseClient.request({ method, params } as any));
      }
      if (SIGN_METHODS.has(method)) {
        if (activeRequest.current) return reply(id, null, { code: 4001, message: 'Finish the current request first' });
        activeRequest.current = request; setPinReset((n) => n+1); return setAsking(request);
      }
      reply(id, null, { code: 4200, message: `${method} isn't supported in Atlas mini apps` });
    } catch (e) {
      reply(id, null, { code: -32603, message: e instanceof Error ? e.message : String(e) });
    }
  };

  // The user said yes on the sheet: sign with their own embedded Solana wallet. A send that fails
  // after it may have gone out is never reported as "nothing taken".
  const approveSolana = async (request: Request) => {
    const wallet = sol.status === 'connected' ? sol.wallets[0] : undefined;
    if (!wallet) throw new Error('Your Solana wallet is still being set up');
    const provider = await wallet.getProvider();
    if (request.method === 'solana:signMessage') {
      const { signature } = await provider.request({ method: 'signMessage', params: { message: String(request.params.message) } });
      return reply(request.id, { signature });
    }
    if (!review || review === 'checking' || review.refusal) return;
    const { signedTransaction } = await provider.request({ method: 'signTransaction', params: { transaction: review.transaction } });
    if (request.method === 'solana:signTransaction') {
      return reply(request.id, { signedTransaction: Buffer.from(signedTransaction.serialize()).toString('base64') });
    }
    const signature = signedTransaction.signatures[0];
    const sent = { signature: Buffer.from(signature).toString('base64') };
    try {
      await solanaConnection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: !!request.params?.options?.skipPreflight,
        maxRetries: 3,
      });
      reply(request.id, sent);
    } catch (e) {
      // Refused by the node's own check: it never went out. Anything else may have.
      if (/simulation failed|preflight/i.test(String((e as Error)?.message ?? e))) throw e;
      await new Promise((r) => setTimeout(r, 3_000));
      const id = getBase58Decoder().decode(signature);
      const status = (await solanaConnection.getSignatureStatuses([id]).catch(() => null))?.value[0];
      if (status && !status.err) return reply(request.id, sent);
      reply(request.id, null, { code: -32603, message: 'It may have gone through' });
      throw new MaybeSent();
    }
  };

  const decide = async (approve: boolean, pin?: string) => {
    const request = asking;
    if (!request || processing.current) return;
    if (!approve) {
      reply(request.id, null, { code: 4001, message: 'The user rejected the request' });
      close();
      return;
    }
    if (!pin) return;
    processing.current = true; setBusy(true); setProblem(null);
    try {
      const action: PinAction = { type: 'wallet', origin: 'https://' + app.origin,
        request: { method: request.method, params: request.params } };
      const grant = await authorizePin(getAccessToken, pin, action);
      if (!mounted.current || activeRequest.current !== request) return;
      await consumePin(getAccessToken, grant.authorization, action);
      if (!mounted.current || activeRequest.current !== request) return;
      if (onSolana) {
        await approveSolana(request);
        close();
        return;
      }
      const wallet = eth.wallets[0];
      if (!wallet) return;
      const provider = await wallet.getProvider();
      let result: unknown;
      if (request.method === 'eth_sendTransaction') {
        const tx = request.params[0] as { to?: string; data?: string; value?: string; gas?: string };
        result = await provider.request({
          method: 'eth_sendTransaction',
          params: [{ from: wallet.address, to: tx.to, data: tx.data ?? '0x', value: tx.value ?? '0x0', chainId: numberToHex(base.id) }],
        });
      } else {
        result = await provider.request({ method: request.method, params: request.params } as any);
      }
      reply(request.id, result);
      close();
    } catch (e) {
      if (mounted.current) setProblem(e instanceof MaybeSent ? e.message : friendlyTxError(e));
    } finally {
      processing.current = false;
      if (mounted.current) { setBusy(false); setPinReset((n) => n+1); }
    }
  };

  const refusal = onSolana ? solanaRefusal(asking, review) : null;
  const checking = review === 'checking';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="close" size={24} color="textPrimary" />
        </Pressable>
        <View style={styles.barText}>
          <Text variant="bodyStrong">{app.name}</Text>
          <Text variant="caption" color="textSecondary">
            {app.origin} · Atlas wallet on {onSolana ? 'Solana' : 'Base'}
          </Text>
        </View>
      </View>
      <WebView
        ref={web}
        source={{ uri: app.url }}
        injectedJavaScriptBeforeContentLoaded={onSolana ? SOLANA_PROVIDER_SCRIPT : PROVIDER_SCRIPT}
        onMessage={onMessage}
        // The app stays on its own site; links elsewhere open in the phone's browser.
        onShouldStartLoadWithRequest={(request) => {
          if (!request.isTopFrame || onAppSite(app, request.url)) return true;
          if (/^https?:/i.test(request.url)) Linking.openURL(request.url).catch(() => {});
          return false;
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accentPink} />
          </View>
        )}
        style={styles.web}
      />

      <Modal visible={!!asking} transparent animationType="slide" onRequestClose={() => decide(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            {asking && onSolana ? <SolanaDetails app={app} request={asking} review={review} /> : null}
            {asking && !onSolana ? <RequestDetails app={app} request={asking} /> : null}
            {refusal ? <Text color="danger">{refusal}</Text> : null}
            {problem ? <Text color="danger">{problem}</Text> : null}
            {refusal ? (
              <PillButton label="Close" tone="secondary" onPress={() => decide(false)} />
            ) : (
              <>
                <Text color="textSecondary">Enter your payment PIN to approve.</Text>
                <PinPad resetKey={pinReset} disabled={checking || busy} onComplete={(pin) => void decide(true, pin)} />
                {busy ? <ActivityIndicator color={colors.accentPink} /> : null}
                <PillButton label="Reject" tone="secondary" disabled={busy} onPress={() => decide(false)} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Why Atlas won't sign a Solana request, if it won't.
function solanaRefusal(request: Request | null, review: Review | null): string | null {
  if (!request) return null;
  if (request.method === 'solana:signMessage') {
    return looksLikeTransaction(Buffer.from(String(request.params?.message ?? ''), 'base64'))
      ? 'This “message” is really a transaction, and signing it would approve that transaction. Atlas won’t sign it.'
      : null;
  }
  return review && review !== 'checking' ? review.refusal : null;
}

// A message's text, or its bytes in hex when it isn't readable text.
function readable(bytes: Buffer): { text: string; binary: boolean } {
  const text = bytes.toString('utf8');
  const clean = Buffer.from(text, 'utf8').equals(bytes) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text);
  return clean ? { text, binary: false } : { text: `0x${bytes.toString('hex')}`, binary: true };
}

function SolanaDetails({ app, request, review }: { app: MiniApp; request: Request; review: Review | null }) {
  if (request.method === 'solana:signMessage') {
    const { text, binary } = readable(Buffer.from(String(request.params?.message ?? ''), 'base64'));
    return (
      <>
        <Text variant="title">{request.params?.signIn ? 'Sign in' : 'Sign a message'}</Text>
        <Text color="textSecondary">
          {app.name} ({app.origin}) wants your signature. Signing doesn&apos;t move money by itself.
        </Text>
        <View style={styles.message}>
          <Text numberOfLines={10}>{text}</Text>
        </View>
        {binary ? (
          <Text variant="caption" color="danger">
            This isn&apos;t readable text. Only sign it if you trust {app.name}.
          </Text>
        ) : null}
      </>
    );
  }
  const sends = request.method === 'solana:signAndSendTransaction';
  return (
    <>
      <Text variant="title">{sends ? 'Send a transaction' : 'Sign a transaction'}</Text>
      <Text color="textSecondary">
        {app.name} ({app.origin}) wants your wallet to {sends ? 'send' : 'sign'} this on Solana.
      </Text>
      {review === 'checking' || !review ? (
        <View style={styles.checking}>
          <ActivityIndicator color={colors.accentPink} />
          <Text color="textSecondary">Checking what this does…</Text>
        </View>
      ) : review.refusal ? null : (
        <>
          {review.changes.length ? (
            review.changes.map((c) => (
              <View key={c.label} style={styles.detail}>
                <Text color="textSecondary">{c.positive ? 'You get' : 'You send'}</Text>
                <Text variant="bodyStrong" color={c.positive ? 'success' : 'textPrimary'}>
                  {c.positive ? '+' : ''}
                  {c.amount} {c.label}
                </Text>
              </View>
            ))
          ) : (
            <Detail label="Balance change" value="None" />
          )}
          <Detail label="Network fee" value={`${review.fee} SOL`} />
          {review.unknown.length ? (
            <Text variant="caption" color="danger">
              It also runs programs Atlas doesn&apos;t know ({review.unknown.join(', ')}). Only approve if you trust {app.name}.
            </Text>
          ) : null}
        </>
      )}
    </>
  );
}

// What the mini app is asking for, in plain words.
function RequestDetails({ app, request }: { app: MiniApp; request: Request }) {
  if (request.method === 'eth_sendTransaction') {
    const tx = request.params[0] as { to?: string; data?: string; value?: string };
    const value = tx.value && isHex(tx.value) ? BigInt(tx.value) : 0n;
    return (
      <>
        <Text variant="title">Send a transaction</Text>
        <Text color="textSecondary">{app.name} wants your wallet to send this on Base.</Text>
        <Detail label="To" value={tx.to ? `${tx.to.slice(0, 8)}…${tx.to.slice(-6)}` : 'New contract'} />
        <Detail label="Sends" value={`${formatEther(value)} ETH`} />
        {tx.data && tx.data !== '0x' ? <Detail label="Calls" value="A contract function" /> : null}
        <Text variant="caption" color="textSecondary">
          The network fee comes from the ETH in your wallet on Base.
        </Text>
      </>
    );
  }
  let message = '';
  if (request.method === 'personal_sign') {
    const raw = String(request.params[0] ?? '');
    try {
      message = isHex(raw) ? hexToString(raw) : raw;
    } catch {
      message = raw;
    }
  } else {
    try {
      const typed = JSON.parse(String(request.params[1] ?? '{}')) as { domain?: { name?: string }; primaryType?: string };
      message = `${typed.primaryType ?? 'Data'} for ${typed.domain?.name ?? app.name}`;
    } catch {
      message = 'Structured data';
    }
  }
  return (
    <>
      <Text variant="title">Sign a message</Text>
      <Text color="textSecondary">{app.name} wants your signature. Signing doesn&apos;t move money by itself.</Text>
      <View style={styles.message}>
        <Text numberOfLines={8}>{message}</Text>
      </View>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text color="textSecondary">{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  barText: {
    flex: 1,
  },
  web: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgBase,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    backgroundColor: colors.bgSurface,
  },
  message: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bgBase,
  },
  checking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
}));
