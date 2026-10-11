import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const require = createRequire(import.meta.url);
function loadTs(file, imports = {}, globals = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => name in imports ? imports[name] : require(name),
    console, setTimeout, clearTimeout, setInterval, clearInterval, URLSearchParams, ...globals });
  return exports;
}
function hookRuntime() {
  const slots = []; let index = 0; let effects = [];
  const memo = (factory, deps) => {
    const key = index++; const previous = slots[key];
    if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) {
      slots[key] = { deps, value: factory() };
    }
    return slots[key].value;
  };
  return {
    react: {
      useCallback: (fn, deps) => memo(() => fn, deps), useMemo: memo,
      useRef: value => { const key = index++; return slots[key] ??= { current: value }; },
      useState: value => {
        const key = index++;
        if (!slots[key]) slots[key] = { value: typeof value === 'function' ? value() : value,
          set(next) { slots[key].value = typeof next === 'function' ? next(slots[key].value) : next; } };
        return [slots[key].value, slots[key].set];
      },
      useEffect: (effect, deps) => {
        const key = index++; const previous = slots[key];
        if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) {
          effects.push(() => { previous?.cleanup?.(); slots[key] = { deps, cleanup: effect() }; });
        }
      },
    },
    render(hook) { index = 0; const value = hook(); const pending = effects; effects = []; pending.forEach(effect => effect()); return value; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
function clock() {
  let next = 0; const timers = new Map();
  return {
    setTimeout(fn) { timers.set(++next, fn); return next; },
    clearTimeout(id) { timers.delete(id); },
    async tick() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); await flush(); },
    count: () => timers.size,
  };
}
function nativeBridge() {
  const runtime = hookRuntime();
  let state = { user: { id: 'alice', linked_accounts: [] }, isReady: true, error: null, logout: async () => {} };
  let status = 'connecting';
  const getAccessToken = async () => state.user?.id + '-token';
  const value = { state: { status: 'idle' }, login: async () => {} };
  const module = loadTs('../src/auth/provider.tsx', {
    react: runtime.react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '@privy-io/expo': {
      PrivyProvider: 'PrivyProvider', getAccessToken, usePrivy: () => state,
      useEmbeddedEthereumWallet: () => ({ wallets: [{ address: '0xalice' }] }),
      useEmbeddedSolanaWallet: () => ({ status, wallets: [{ address: 'solalice' }] }),
      useLoginWithEmail: () => value, useLoginWithOAuth: () => value,
    },
    '@/notifications/device': { disconnectNotifications: async () => {} },
    '@/auth/context': { AtlasAuthContext: { Provider: 'AtlasAuth' }, errorMessage: String },
    '@/auth/device-session': { markSigningOut() {} },
    '@/auth/wallet-reconnect': { createWalletReconnect: () => ({ update() {}, cancel() {} }), hasEmbeddedWallet: () => true },
    '@/auth/otp': { useOtpFlow: () => ({}) }, '@/config': { privy: {} }, '@/signing/chains': { privyEvmChains: [] },
  });
  const bridge = module.AtlasAuthProvider({ children: null }).props.children.type;
  return {
    render: () => runtime.render(() => bridge({ children: null })).props.value,
    redraw() { state = { ...state, user: { ...state.user } }; status = 'connected'; },
    getAccessToken,
  };
}

test('native wallet/auth redraw retains the SDK access-token callback identity', () => {
  const bridge = nativeBridge(); const first = bridge.render(); bridge.redraw(); const next = bridge.render();
  assert.equal(first.getAccessToken, bridge.getAccessToken);
  assert.equal(next.getAccessToken, first.getAccessToken);
});

test('native wallet redraw does not cancel or restart a pending market list', async () => {
  const bridge = nativeBridge(); let auth = bridge.render(); const runtime = hookRuntime(); const time = clock();
  const answer = deferred(); let calls = 0;
  const { createReadCache } = loadTs('../src/api/read-cache.ts');
  const market = loadTs('../src/api/markets.ts', {
    react: runtime.react, '@/auth/context': { useAtlasAuth: () => auth, errorMessage: String },
    '@/settings/context': { useSettings: () => ({ displayCurrency: 'NGN' }) },
    '@/api/read-cache': { createReadCache },
    '@/api/client': { engineGet: () => { calls++; return answer.promise; }, EngineTimeout: class extends Error {} },
  }, { setTimeout: time.setTimeout, clearTimeout: time.clearTimeout });
  const render = () => runtime.render(() => market.useAssets('crypto', ''));
  render(); await time.tick(); assert.equal(calls, 1);
  bridge.redraw(); auth = bridge.render(); render(); await time.tick(); assert.equal(calls, 1);
  const assets = [{ assetId: 'asset', price: { amount: '10', currency: 'NGN' } }];
  answer.resolve({ assets, searchComplete: true }); await flush();
  const settled = render(); assert.equal(settled.loading, false); assert.equal(settled.assets, assets);
  runtime.unmount();
});

test('market read cache coalesces concurrent loads and expires without poisoning a later retry', async () => {
  let now = 0; const { createReadCache } = loadTs('../src/api/read-cache.ts', {}, { Date: { now: () => now } });
  const cache = createReadCache(10, 2); const response = deferred(); let calls = 0;
  const fetch = () => { calls++; return response.promise; };
  const first = cache.read('alice:NGN:crypto', fetch);
  assert.equal(cache.read('alice:NGN:crypto', fetch), first); await flush(); assert.equal(calls, 1);
  response.resolve('answer'); assert.equal(await first, 'answer');
  assert.equal(await cache.read('alice:NGN:crypto', fetch), 'answer'); assert.equal(calls, 1);
  now = 10; assert.equal(cache.peek('alice:NGN:crypto'), null);
  await assert.rejects(cache.read('alice:NGN:crypto', () => Promise.reject(new Error('aborted'))), /aborted/);
  assert.equal(await cache.read('alice:NGN:crypto', async () => 'recovered'), 'recovered');
});

test('account and currency keys cannot reuse another market result, refresh bypasses saved results', async () => {
  const { createReadCache } = loadTs('../src/api/read-cache.ts'); const cache = createReadCache(10_000, 2);
  await cache.read('alice:NGN', async () => 'naira');
  assert.equal(cache.peek('bob:NGN'), null); assert.equal(cache.peek('alice:USD'), null);
  assert.equal(await cache.read('alice:NGN', async () => 'fresh', true), 'fresh');
  await cache.read('bob:NGN', async () => 'bob'); await cache.read('alice:USD', async () => 'dollars');
  assert.equal(cache.peek('alice:NGN'), null);
});

test('incomplete searches are not cached, so retry can discover omitted providers', async () => {
  const { createReadCache } = loadTs('../src/api/read-cache.ts');
  const cache = createReadCache(10_000, 2, answer => answer.complete);
  await cache.read('query', async () => ({ complete: false, assets: [] }));
  assert.equal(cache.peek('query'), null);
  const recovered = await cache.read('query', async () => ({ complete: true, assets: ['SOL'] }));
  assert.equal(recovered.assets[0], 'SOL');
});

test('compact stats work even when Intl ignores compact notation, including unit rollover', () => {
  const { formatCompactMoney } = loadTs('../src/format/money.ts', {}, {
    Intl: { NumberFormat: function(locale, options) { return new Intl.NumberFormat(locale, { ...options, notation: 'standard' }); } },
  });
  for (const [amount, expected] of [['5849884621.11', '₦5.85B'], ['4561633950.80', '₦4.56B'],
    ['788415664.84', '₦788.42M'], ['999999.9', '₦1M'], ['1000', '₦1K'], ['-200000000', '−₦200M']]) {
    assert.equal(formatCompactMoney({ amount, currency: 'NGN' }), expected);
  }
  assert.equal(formatCompactMoney({ amount: '1250000', currency: 'USD' }), '$1.25M');
});

test('market rows reuse currency formatters while preserving full-value and small-price display', () => {
  let constructions = 0;
  const { formatMoney, formatPrice } = loadTs('../src/format/money.ts', {}, {
    Intl: { NumberFormat: function(locale, options) { constructions++; return new Intl.NumberFormat(locale, options); } },
  });
  for (let n = 0; n < 100; n++) assert.equal(formatMoney({ amount: '1234.50', currency: 'NGN' }), '₦1,234.50');
  assert.equal(constructions, 1);
  assert.equal(formatPrice({ amount: '0.02830', currency: 'NGN' }), '₦0.0283');
  assert.equal(constructions, 2);
});


test('an asset or currency switch hides the previous chart and retires its pending response', async () => {
  const runtime = hookRuntime(); const requests = [];
  let currency = 'NGN'; let asset = 'SOL'; let range = '1D';
  const token = async () => 'alice-token';
  const market = loadTs('../src/api/markets.ts', {
    react: runtime.react, '@/auth/context': { useAtlasAuth: () => ({ getAccessToken: token }), errorMessage: String },
    '@/settings/context': { useSettings: () => ({ displayCurrency: currency }) },
    '@/api/read-cache': loadTs('../src/api/read-cache.ts'),
    '@/api/client': {
      engineGet: (path, _token, options) => { const answer = deferred(); requests.push({ path, options, answer }); return answer.promise; },
      EngineTimeout: class extends Error {},
    },
  });
  const render = () => runtime.render(() => market.useAssetChart(asset, range));
  assert.equal(render().loading, true); await flush();
  assert.equal(requests[0].options.timeoutMs, 60_000);
  const first = { assetId: 'SOL', range: '1D', currency: 'NGN', points: [[1, 10]] };
  requests[0].answer.resolve(first); await flush();
  assert.equal(render().chart, first);
  range = '1W'; assert.equal(render().chart, first); await flush();
  asset = 'BTC'; const switched = render(); await flush();
  assert.equal(switched.chart, null); assert.equal(switched.loading, true);
  requests[1].answer.resolve({ ...first, range: '1W' }); await flush();
  assert.equal(render().chart, null);
  const second = { assetId: 'BTC', range: '1W', currency: 'NGN', points: [[1, 20]] };
  requests[2].answer.resolve(second); await flush();
  assert.equal(render().chart, second); assert.equal(render().loading, false);
  currency = 'USD'; assert.equal(render().chart, null); await flush();
  requests[3].answer.resolve({ ...second, currency: 'USD' }); await flush();
  assert.equal(render().chart.currency, 'USD'); runtime.unmount();
});
