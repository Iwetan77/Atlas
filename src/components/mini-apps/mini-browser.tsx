// A mini app inside Atlas: the dapp runs in a WebView with the Atlas wallet injected. Reads go to
// Base; every signature or transaction waits for the user's yes on an Atlas sheet first.
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { formatEther, hexToString, isHex, numberToHex } from 'viem';
import { base } from 'viem/chains';

import { useAtlasAuth } from '@/auth/context';
import type { MiniApp } from '@/components/mini-apps/catalog';
import { PROVIDER_SCRIPT, READ_METHODS, SIGN_METHODS } from '@/components/mini-apps/provider-script';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { evmClient } from '@/signing/chains';
import { friendlyTxError } from '@/signing/errors';
import { colors, maxContentWidth, radii, spacing } from '@/theme';

type Request = { id: number; method: string; params: unknown[] };
type RpcError = { code: number; message: string };

const BASE_CHAIN_ID = '0x2105';
const baseClient = evmClient(base);

export function MiniBrowser({ app }: { app: MiniApp }) {
  const insets = useSafeAreaInsets();
  const { wallets } = useAtlasAuth();
  const eth = useEmbeddedEthereumWallet();
  const web = useRef<WebView>(null);
  const [asking, setAsking] = useState<Request | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const address = wallets.base;

  const reply = (id: number, result: unknown, error?: RpcError) => {
    web.current?.injectJavaScript(
      `window.__atlasReply(${id}, ${JSON.stringify(result ?? null)}, ${JSON.stringify(error ?? null)}); true;`,
    );
  };

  const onMessage = async (event: WebViewMessageEvent) => {
    let request: Request;
    try {
      request = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
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
      if (SIGN_METHODS.has(method)) return setAsking(request);
      reply(id, null, { code: 4200, message: `${method} isn't supported in Atlas mini apps` });
    } catch (e) {
      reply(id, null, { code: -32603, message: e instanceof Error ? e.message : String(e) });
    }
  };

  const decide = async (approve: boolean) => {
    const request = asking;
    if (!request) return;
    if (!approve) {
      reply(request.id, null, { code: 4001, message: 'The user rejected the request' });
      setAsking(null);
      return;
    }
    const wallet = eth.wallets[0];
    if (!wallet) return;
    setBusy(true);
    setProblem(null);
    try {
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
      setAsking(null);
    } catch (e) {
      setProblem(friendlyTxError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="close" size={24} color="textPrimary" />
        </Pressable>
        <View style={styles.barText}>
          <Text variant="bodyStrong">{app.name}</Text>
          <Text variant="caption" color="textSecondary">
            {app.origin} · Atlas wallet on Base
          </Text>
        </View>
      </View>
      <WebView
        ref={web}
        source={{ uri: app.url }}
        injectedJavaScriptBeforeContentLoaded={PROVIDER_SCRIPT}
        onMessage={onMessage}
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
            {asking ? <RequestDetails app={app} request={asking} /> : null}
            {problem ? <Text color="danger">{problem}</Text> : null}
            <PillButton label="Approve" loading={busy} onPress={() => decide(true)} />
            <PillButton label="Reject" tone="secondary" disabled={busy} onPress={() => decide(false)} />
          </View>
        </View>
      </Modal>
    </View>
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

const styles = StyleSheet.create({
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
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
