import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const realRequire = createRequire(import.meta.url);
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function load(file, imports = {}, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => name in imports ? imports[name] : realRequire(name),
    console, setTimeout, clearTimeout, ...globals });
  return exports;
}
function metadataFixture(engineGet) {
  let now = 0;
  const cache = load('../src/api/read-cache.ts', {}, { Date: { now: () => now } });
  const module = load('../src/api/withdraw.ts', { '@/api/read-cache': cache, '@/api/client': { engineGet } });
  return { ...module, advance(ms) { now += ms; } };
}

test('wallet selector shares public metadata across callers without waiting for a Privy token', async () => {
  const answer = deferred(); const requests = []; let tokens = 0;
  const fixture = metadataFixture((...args) => { requests.push(args); return answer.promise; });
  const legacyToken = async () => { tokens++; throw new Error('wallet session is still reconnecting'); };
  const sheet = fixture.listWithdrawNetworks(legacyToken);
  const screen = fixture.listWithdrawNetworks();
  assert.equal(sheet, screen);
  await flush();
  assert.equal(tokens, 0); assert.equal(requests.length, 1);
  assert.equal(requests[0][0], '/v1/withdrawals/networks'); assert.equal(requests[0][1], null);
  assert.equal(requests[0][2].auth, false); assert.equal(requests[0][2].timeoutMs, 15_000);
  assert.equal(requests[0][2].retries, 0);
  const networks = { enabled: true, networks: [{ id: 'solana-usdc' }] };
  answer.resolve(networks); assert.equal(await sheet, networks);
  assert.equal(await fixture.listWithdrawNetworks(), networks); assert.equal(requests.length, 1);
  fixture.advance(60_000); await fixture.listWithdrawNetworks(); assert.equal(requests.length, 2);
});

test('a hung metadata fetch aborts once and a later screen opening can recover', async () => {
  const timers = new Map(); let next = 0; let fetches = 0;
  const timer = (callback, delay) => { timers.set(++next, { callback, delay }); return next; };
  const client = load('../src/api/client.ts', { '@/config': { engineUrl: 'https://atlas.test' } }, {
    AbortController, setTimeout: timer, clearTimeout: id => timers.delete(id),
    fetch: (_url, { signal }) => {
      fetches++;
      if (fetches > 1) return Promise.resolve({ ok: true, json: async () => ({ enabled: true, networks: [] }) });
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    },
  });
  const fixture = metadataFixture(client.engineGet);
  const pending = fixture.listWithdrawNetworks();
  await flush();
  assert.equal(fetches, 1); assert.equal(timers.size, 1);
  const [{ callback, delay }] = [...timers.values()]; assert.equal(delay, 15_000);
  const refused = assert.rejects(pending, client.EngineTimeout);
  callback(); await refused; assert.equal(fetches, 1); assert.equal(timers.size, 0);
  const recovered = await fixture.listWithdrawNetworks();
  assert.equal(recovered.enabled, true); assert.equal(fetches, 2);
});

function screenFixture() {
  const answer = deferred(); const effects = []; const changes = []; const cleanups = [];
  let slot = 0;
  const react = {
    useState(value) { const index = slot++; return [value, next => changes.push({ index, next })]; },
    useEffect(effect) { effects.push(effect); }, useCallback: callback => callback,
  };
  const imports = {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': {}, 'expo-router': { router: {} }, 'expo-clipboard': {},
    '@/api/withdraw': { listWithdrawNetworks: () => answer.promise },
    '@/api/intents': { useRunIntent: () => async () => {}, StillSettling: class extends Error {} },
    '@/api/use-live-quote': { useLiveQuote: () => ({ quote: null, quoting: false, error: null, secondsLeft: 0 }) },
    '@/auth/context': { useAtlasAuth: () => ({ getAccessToken: async () => { throw new Error('must not load a token'); } }), errorMessage: error => error.message },
    '@/settings/context': { useSettings: () => ({ displayCurrency: 'NGN' }) },
    '@/funding/withdraw': { useBackToWithdraw() {} },
    '@/theme': { colors: {}, radii: { pill: 999 }, spacing: { sm: 8, md: 12, lg: 16 }, themedStyles: factory => factory() },
  };
  const noRuntime = {
    '@/components/amount-input': {}, '@/components/money-error': {}, '@/components/result-view': {},
    '@/components/send/spendable-card': {}, '@/components/token-chain-logo': {},
    '@/components/ui/back-header': {}, '@/components/ui/card': {}, '@/components/ui/field': {},
    '@/components/ui/pill-button': {}, '@/components/ui/screen': {}, '@/components/ui/select-sheet': {},
    '@/components/ui/text': {}, '@/components/quote-timer': {}, '@/format/money': {}, '@/signing/errors': {},
  };
  const screen = load('../src/app/send/wallet.tsx', { ...noRuntime, ...imports });
  screen.default(); effects.forEach(effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
  return { answer, changes, unmount() { cleanups.forEach(cleanup => cleanup()); } };
}

test('a retired wallet screen ignores both late network-list success and failure', async () => {
  for (const success of [true, false]) {
    const fixture = screenFixture(); fixture.unmount();
    if (success) fixture.answer.resolve({ enabled: true, networks: [] });
    else fixture.answer.reject(new Error('offline'));
    await flush(); assert.equal(fixture.changes.length, 0);
  }
});

test('an active wallet screen accepts its public metadata response', async () => {
  const fixture = screenFixture(); const response = { enabled: true, networks: [] };
  fixture.answer.resolve(response); await flush();
  assert.equal(fixture.changes.length, 1); assert.equal(fixture.changes[0].index, 0);
  assert.equal(fixture.changes[0].next, response); fixture.unmount();
});
