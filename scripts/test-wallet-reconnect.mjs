import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { createWalletReconnect, hasEmbeddedWallet } from '../src/auth/wallet-reconnect.ts';

const flush = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function clock() {
  let id = 0;
  const timers = new Map();
  return {
    scheduler: { set(callback, delay) { timers.set(++id, { callback, delay }); return id; }, clear(key) { timers.delete(key); } },
    delays: () => [...timers.values()].map(value => value.delay),
    async next() { const [key, value] = timers.entries().next().value ?? []; assert.ok(value, 'a retry must be scheduled'); timers.delete(key); value.callback(); await flush(); },
  };
}
const snapshot = (patch = {}) => ({ ready: true, userId: 'alice', status: 'error', hasWallet: true, connect: async () => {}, ...patch });

test('startup transport errors get three delayed attempts and stop, even after redraws', async () => {
  const time = clock(); const connection = createWalletReconnect(time.scheduler);
  let calls = 0;
  const state = snapshot({ connect: async () => { calls++; throw new Error('transport not loaded'); } });
  connection.update(state);
  connection.update({ ...state });
  assert.deepEqual(time.delays(), [750]);
  for (const delay of [750, 1500, 3000]) {
    assert.deepEqual(time.delays(), [delay]); await time.next();
  }
  connection.update({ ...state });
  assert.equal(calls, 3); assert.deepEqual(time.delays(), []);
});

test('SDK startup, signed-out sessions and wallets not yet created cannot reconnect', () => {
  for (const patch of [{ ready: false }, { userId: null }, { hasWallet: false }, { status: 'connecting' }, { status: 'reconnecting' }, { status: 'creating' }, { status: 'not-created' }]) {
    const time = clock(); const connection = createWalletReconnect(time.scheduler);
    connection.update(snapshot(patch));
    assert.deepEqual(time.delays(), []);
  }
});

test('recovery has one owner, stays single-flight across redraws, and success clears retries', async () => {
  const time = clock(); const connection = createWalletReconnect(time.scheduler); const attempt = deferred();
  let calls = 0;
  const state = snapshot({ status: 'needs-recovery', recover: () => { calls++; return attempt.promise; } });
  connection.update(state); await time.next();
  connection.update({ ...state }); connection.update({ ...state });
  assert.equal(calls, 1); assert.deepEqual(time.delays(), []);
  connection.update({ ...state, status: 'connected' }); attempt.resolve(); await flush();
  connection.update({ ...state, status: 'error' });
  assert.deepEqual(time.delays(), [750]);
});

test('sign-out cancels scheduled reconnect and cannot restart one after an in-flight failure', async () => {
  const time = clock(); const connection = createWalletReconnect(time.scheduler); const attempt = deferred();
  connection.update(snapshot({ connect: () => attempt.promise })); await time.next();
  connection.update(snapshot({ userId: null }));
  attempt.reject(new Error('offline')); await flush();
  assert.deepEqual(time.delays(), []);
  connection.update(snapshot()); connection.cancel();
  assert.deepEqual(time.delays(), []);
});

test('account switches and remounts wait for an outstanding transport before trying again', async () => {
  const time = clock(); const connection = createWalletReconnect(time.scheduler); const attempt = deferred();
  let alice = 0; let bob = 0;
  connection.update(snapshot({ connect: () => { alice++; return attempt.promise; } })); await time.next();
  connection.cancel();
  connection.update(snapshot({ userId: 'bob', connect: async () => { bob++; } }));
  assert.equal(alice, 1); assert.equal(bob, 0); assert.deepEqual(time.delays(), []);
  attempt.resolve(); await flush();
  assert.deepEqual(time.delays(), [750]); await time.next(); assert.equal(bob, 1);
  connection.cancel();
});

function hookRuntime() {
  const slots = []; let index = 0; let effects = [];
  return {
    react: {
      useCallback(callback) { return callback; },
      useRef(value) { const key = index++; return slots[key] ??= { current: value }; },
      useEffect(effect, deps) {
        const key = index++; const previous = slots[key];
        const changed = !previous || deps.length !== previous.deps.length || deps.some((value, n) => !Object.is(value, previous.deps[n]));
        if (changed) effects.push(() => { previous?.cleanup?.(); slots[key] = { deps, cleanup: effect() }; });
      },
    },
    render(hook) { index = 0; const value = hook(); const commit = effects; effects = []; commit.forEach(effect => effect()); return value; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
function loadTs(file, imports) {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const realRequire = createRequire(import.meta.url);
  const context = { exports, require: (name) => name in imports ? imports[name] : realRequire(name), setTimeout, clearTimeout, console, Buffer };
  vm.runInNewContext(output, context);
  return exports;
}
function intentFixture(options = {}) {
  const runtime = hookRuntime(); const confirm = deferred();
  let signs = 0; let posts = 0; let tokenCalls = 0;
  const readySigner = { ready: true, sign: async () => { signs++; return 'signed-once'; }, send: options.send ?? (async () => { throw new Error('must sign, not send'); }) };
  let auth = { userId: 'alice', wallets: { base: '0xalice' }, getAccessToken: async () => options.getAccessToken ? options.getAccessToken(++tokenCalls, auth.userId) : auth.userId === 'alice' ? 'alice-test-token' : 'other-test-token' };
  let signer = { ready: false, sign: async () => { throw new Error('startup signer is stale'); } };
  class ActionCancelled extends Error {}
  class EngineUnreachable extends Error {}
  class EngineTimeout extends Error {}
  const status = (stage, state = 'pending') => ({ intentId: 'test-intent', stage, state, txIds: [], error: null });
  const intents = loadTs('../src/api/intents.ts', {
    react: runtime.react,
    '@/auth/context': { useAtlasAuth: () => auth },
    '@/signing/use-signer': { useSigner: () => signer },
    '@/signing/confirm': { ActionCancelled, useConfirmAndExecute: () => () => confirm.promise },
    '@/api/predictions': { predictionGeo: async () => true },
    '@/signing/prediction': { submitPredictionStep: async () => { throw new Error('no prediction in test'); } },
    '@/signing/chains': { sendOnce: async (send) => send(), waitForTx: async () => {} },
    '@/api/client': {
      EngineUnreachable, EngineTimeout,
      engineGet: async () => ({ transactions: options.transactions ?? [{ chain: 'solana', transaction: 'unsigned', submit: 'engine' }] }),
      enginePost: async (_url, token, body) => {
        posts++;
        if (options.assertToken) options.assertToken(token); else assert.equal(token, 'alice-test-token');
        if (posts === 1) return status('sign');
        if (options.transactions) assert.equal(body.sent[0].id, '0xalready-sent');
        else assert.equal(body.signed[0].transaction, 'signed-once');
        return status('settle', 'filled');
      },
    },
  });
  const render = () => runtime.render(intents.useRunIntent);
  return {
    render, runtime, confirm, ActionCancelled,
    getPlan: async () => ({ intentId: 'test-intent', stage: 'validate', transactions: [] }),
    hydrate() { signer = readySigner; return render(); },
    signOut() { auth = { ...auth, userId: null }; render(); },
    switchUser(userId) { auth = { ...auth, userId }; render(); },
    counts: () => ({ signs, posts }),
  };
}
const report = { sent: [], signed: [], pinAuthorization: 'test-approval' };

test('a funded purchase uses the wallet that became ready during PIN confirmation, once', async () => {
  const fixture = intentFixture(); const run = fixture.render(); const result = run(fixture.getPlan);
  await flush(); fixture.hydrate(); fixture.confirm.resolve(report);
  const final = await result;
  assert.equal(final.state, 'filled'); assert.deepEqual(fixture.counts(), { signs: 1, posts: 2 });
});
test('cancelled confirmation cannot report or sign a purchase', async () => {
  const fixture = intentFixture(); const result = fixture.render()(fixture.getPlan);
  await flush(); fixture.confirm.reject(new fixture.ActionCancelled());
  assert.equal(await result, null); assert.deepEqual(fixture.counts(), { signs: 0, posts: 0 });
});
test('sign-out or unmount after approval reports the owned completed step and stops new signing', async () => {
  for (const action of ['signOut', 'unmount']) {
    const fixture = intentFixture(); const result = fixture.render()(fixture.getPlan);
    await flush();
    if (action === 'signOut') fixture.signOut(); else fixture.runtime.unmount();
    fixture.confirm.resolve({ ...report, sent: [{ chain: 'base', id: '0xinitial-sent' }] });
    await assert.rejects(result, fixture.ActionCancelled);
    assert.deepEqual(fixture.counts(), { signs: 0, posts: 1 });
  }
});

test('an Android signer callback retained at startup reads the hydrated wallet before signing', async () => {
  const runtime = hookRuntime();
  let connected = false; let authenticated = true; let signed = 0;
  const wallet = {
    address: 'test-solana-address',
    getProvider: async () => ({ request: async () => { signed++; return { signedTransaction: { serialize: () => Buffer.from('signed') } }; } }),
  };
  const signerModule = loadTs('../src/signing/use-signer.ts', {
    react: runtime.react,
    '@privy-io/expo': {
      usePrivy: () => ({ isReady: true, user: authenticated ? { id: 'alice' } : null }),
      useEmbeddedEthereumWallet: () => ({ wallets: [{ address: '0xalice' }] }),
      useEmbeddedSolanaWallet: () => ({ status: connected ? 'connected' : 'disconnected', wallets: [wallet] }),
      useAuthorizationSignature: () => ({ generateAuthorizationSignature: async () => ({ signature: 'approval' }) }),
    },
    '@solana/web3.js': { VersionedTransaction: { deserialize: () => ({}) } },
    '@/api/predictions': { predictionGeo: async () => true },
    '@/signing/chains': { evmChainFor: () => ({ id: 8453 }), solanaConnection: {} },
    viem: { numberToHex: () => '0x0' },
  });
  const initial = runtime.render(signerModule.useSigner);
  assert.equal(initial.ready, false);
  connected = true; const hydrated = runtime.render(signerModule.useSigner);
  assert.equal(hydrated.ready, true);
  assert.equal(await initial.sign({ chain: 'solana', transaction: 'AA==', submit: 'engine' }), Buffer.from('signed').toString('base64'));
  assert.equal(signed, 1);
  authenticated = false; runtime.render(signerModule.useSigner);
  await assert.rejects(initial.sign({ chain: 'solana', transaction: 'AA==' }), /session ended/);
  assert.equal(signed, 1);
});
test('sign-out while an Android provider loads stops before asking it to sign', async () => {
  const runtime = hookRuntime(); const provider = deferred(); let authenticated = true; let signs = 0;
  const signerModule = loadTs('../src/signing/use-signer.ts', {
    react: runtime.react,
    '@privy-io/expo': {
      usePrivy: () => ({ isReady: true, user: authenticated ? { id: 'alice' } : null }),
      useEmbeddedEthereumWallet: () => ({ wallets: [{ address: '0xalice' }] }),
      useEmbeddedSolanaWallet: () => ({ status: 'connected', wallets: [{ getProvider: () => provider.promise }] }),
      useAuthorizationSignature: () => ({ generateAuthorizationSignature: async () => ({ signature: 'approval' }) }),
    },
    '@solana/web3.js': { VersionedTransaction: { deserialize: () => ({}) } },
    '@/api/predictions': { predictionGeo: async () => true },
    '@/signing/chains': { evmChainFor: () => ({ id: 8453 }), solanaConnection: {} },
    viem: { numberToHex: () => '0x0' },
  });
  const initial = runtime.render(signerModule.useSigner);
  const signing = initial.sign({ chain: 'solana', transaction: 'AA==' });
  await flush(); authenticated = false; runtime.render(signerModule.useSigner);
  provider.resolve({ request: async () => { signs++; } });
  await assert.rejects(signing, /session ended/); assert.equal(signs, 0);
});

test('unmount during the final wallet send still reports the owned transaction once', async () => {
  const send = deferred(); const started = deferred(); let sends = 0;
  const fixture = intentFixture({
    transactions: [{ chain: 'base', chainId: 8453, to: '0xrecipient', value: '1' }],
    send: async () => { sends++; started.resolve(); return send.promise; },
  });
  const result = fixture.render()(fixture.getPlan);
  await flush(); fixture.hydrate(); fixture.confirm.resolve(report); await started.promise;
  assert.equal(sends, 1);
  fixture.runtime.unmount(); send.resolve({ chain: 'base', id: '0xalready-sent' });
  const final = await result;
  assert.equal(final.state, 'filled'); assert.equal(sends, 1);
  assert.deepEqual(fixture.counts(), { signs: 0, posts: 2 });
});
test('unmount after an earlier send stops before the next wallet request', async () => {
  const send = deferred(); const started = deferred(); let sends = 0;
  const fixture = intentFixture({
    transactions: [
      { chain: 'base', chainId: 8453, to: '0xapproval', value: '0' },
      { chain: 'base', chainId: 8453, to: '0xswap', value: '0' },
    ],
    send: async () => { sends++; started.resolve(); return send.promise; },
  });
  const result = fixture.render()(fixture.getPlan);
  await flush(); fixture.hydrate(); fixture.confirm.resolve(report); await started.promise;
  fixture.runtime.unmount(); send.resolve({ chain: 'base', id: '0xalready-sent' });
  await assert.rejects(result, fixture.ActionCancelled);
  assert.equal(sends, 1); assert.equal(fixture.counts().posts, 1);
});
test('linked embedded wallet accounts permit reconnect while the native list hydrates', async () => {
  const linked = [{ type: 'wallet', chain_type: 'solana', wallet_client_type: 'privy', address: 'existing-solana' }];
  assert.equal(hasEmbeddedWallet(linked, 'solana'), true);
  for (const account of [{ ...linked[0], wallet_client_type: 'phantom' }, { ...linked[0], type: 'email' }, { ...linked[0], address: '' }, { ...linked[0], chain_type: 'ethereum' }]) {
    assert.equal(hasEmbeddedWallet([account], 'solana'), false);
  }
  const time = clock(); const reconnect = createWalletReconnect(time.scheduler); let connects = 0;
  reconnect.update(snapshot({ hasWallet: hasEmbeddedWallet(linked, 'solana'), connect: async () => { connects++; } }));
  await time.next(); assert.equal(connects, 1); reconnect.cancel();
});
test('Android EVM sends use the current typed wallet and refuse unspecified or mismatched chains', async () => {
  const runtime = hookRuntime(); let address = '0xfirst'; const requests = [];
  const chains = loadTs('../src/signing/chains.ts', {
    '@solana/web3.js': { Connection: class {} },
    '@/config': { solana: { rpcUrl: 'https://public-test.invalid' } },
    viem: { createPublicClient: () => ({}), http: () => ({}) },
    'viem/chains': { base: { id: 8453 }, mainnet: { id: 1 }, monad: { id: 143 }, polygon: { id: 137 } },
  });
  const signerModule = loadTs('../src/signing/use-signer.ts', {
    react: runtime.react,
    '@privy-io/expo': {
      usePrivy: () => ({ isReady: true, user: { id: 'alice' } }),
      useEmbeddedEthereumWallet: () => ({ wallets: [{ address, getProvider: async () => ({ request: async (request) => { requests.push(request); return '0xhash'; } }) }] }),
      useEmbeddedSolanaWallet: () => ({ status: 'connected', wallets: [{ address: 'test-solana' }] }),
      useAuthorizationSignature: () => ({ generateAuthorizationSignature: async () => ({ signature: 'approval' }) }),
    },
    '@solana/web3.js': { VersionedTransaction: { deserialize: () => ({}) } },
    '@/api/predictions': { predictionGeo: async () => true },
    '@/signing/chains': chains,
    viem: { numberToHex: number => '0x' + number.toString(16) },
  });
  const initial = runtime.render(signerModule.useSigner);
  address = '0xcurrent'; runtime.render(signerModule.useSigner);
  const tx = { chain: 'base', chainId: 8453, to: '0xrecipient', value: '1' };
  await initial.send(tx);
  assert.equal(requests.length, 1); assert.equal(requests[0].method, 'eth_sendTransaction');
  assert.equal(requests[0].params[0].from, '0xcurrent'); assert.equal(requests[0].params[0].chainId, '0x2105');
  for (const bad of [{ ...tx, chainId: undefined }, { ...tx, chainId: 1 }, { ...tx, chainId: 999 }]) {
    await assert.rejects(initial.send(bad), /network Atlas doesn't sign on/);
  }
  assert.equal(requests.length, 1);
});

test('a long-running owned action refreshes its expired token before reporting', async () => {
  const used = [];
  const fixture = intentFixture({
    getAccessToken: async calls => calls === 1 ? 'alice-expired-token' : 'alice-refreshed-token',
    assertToken: token => { used.push(token); assert.equal(token, 'alice-refreshed-token'); },
  });
  const result = fixture.render()(fixture.getPlan);
  await flush(); fixture.hydrate(); fixture.confirm.resolve(report);
  assert.equal((await result).state, 'filled');
  assert.deepEqual(used, ['alice-refreshed-token', 'alice-refreshed-token']);
  assert.equal(fixture.counts().signs, 1);
});
test('an account switch during refresh reports the completed step with the original owner token', async () => {
  const refresh = deferred(); const refreshing = deferred(); const used = [];
  const fixture = intentFixture({
    getAccessToken: calls => { if (calls === 1) return Promise.resolve('alice-original-token'); refreshing.resolve(); return refresh.promise; },
    assertToken: token => { used.push(token); assert.equal(token, 'alice-original-token'); },
  });
  const result = fixture.render()(fixture.getPlan);
  await flush(); fixture.hydrate();
  fixture.confirm.resolve({ ...report, sent: [{ chain: 'base', id: '0xinitial-sent' }] });
  await refreshing.promise; fixture.switchUser('bob'); refresh.resolve('bob-new-token');
  await assert.rejects(result, fixture.ActionCancelled);
  assert.deepEqual(used, ['alice-original-token']);
  assert.deepEqual(fixture.counts(), { signs: 0, posts: 1 });
});
