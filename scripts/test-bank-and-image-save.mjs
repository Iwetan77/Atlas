import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function runtime() {
  const slots = []; let index = 0; const effects = [];
  return {
    react: {
      useRef(value) { const key = index++; return slots[key] ??= { current: value }; },
      useState(value) { const key = index++; if (!(key in slots)) slots[key] = value; return [slots[key], next => { slots[key] = typeof next === 'function' ? next(slots[key]) : next; }]; },
      useEffect(effect) { const key = index++; if (!(key in slots)) { slots[key] = true; effects.push(effect); } },
      useCallback: callback => callback,
    },
    render(hook) { index = 0; const value = hook(); while (effects.length) effects.shift()(); return value; },
  };
}
function load(file, imports, timers = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; const real = createRequire(import.meta.url);
  vm.runInNewContext(output, { exports, require: name => name in imports ? imports[name] : real(name), setTimeout, clearTimeout, ...timers });
  return exports;
}
function sharingFixture(version = 35, granted = true) {
  const hooks = runtime(); const calls = []; let fail = false; let saving;
  const module = load('../src/components/share/use-share-image.ts', {
    react: hooks.react,
    'react-native': { Platform: { OS: 'android', Version: version } },
    'expo-file-system/legacy': {
      cacheDirectory: 'file:///private/cache/',
      copyAsync: async value => { calls.push(['copy', value.from, value.to]); if (fail) throw Error('copy failed'); },
      deleteAsync: async uri => calls.push(['cleanup', uri]),
      StorageAccessFramework: { requestDirectoryPermissionsAsync: async () => { throw Error('must not open a folder picker'); } },
    },
    'expo-media-library': {
      requestPermissionsAsync: async (writeOnly, permissions) => { calls.push(['permission', writeOnly, ...permissions]); return { granted }; },
      Asset: { create: async uri => { calls.push(['save', uri]); if (saving) await saving; } },
    },
    'expo-sharing': { shareAsync: async () => { throw Error('download must not share a private file path'); } },
    'react-native-view-shot': { captureRef: async () => 'file:///private/capture/no-extension', releaseCapture: () => {} },
  });
  const render = () => hooks.render(() => module.useShareImage({ current: {} }, 1.5, 'atlas-pnl.png', 'Share card'));
  return { render, calls, failCopy() { fail = true; }, blockSave(promise) { saving = promise; } };
}

test('Android saves a named PNG into MediaStore instead of sharing paths or asking for a folder', async () => {
  const fixture = sharingFixture(); await fixture.render().share();
  await fixture.render().menu.onDownload();
  assert.deepEqual(fixture.calls, [
    ['copy', 'file:///private/capture/no-extension', 'file:///private/cache/atlas-pnl.png'],
    ['save', 'file:///private/cache/atlas-pnl.png'],
    ['cleanup', 'file:///private/cache/atlas-pnl.png'],
  ]);
  assert.equal(fixture.render().menu.notice, 'Image saved to Pictures.');
});
test('Android 10 and earlier request write-only access; refusal never claims saved', async () => {
  const fixture = sharingFixture(29, false); await fixture.render().share();
  await fixture.render().menu.onDownload();
  assert.deepEqual(fixture.calls, [['permission', true]]);
  assert.equal(fixture.render().menu.notice, null);
  assert.match(fixture.render().menu.error, /Allow Atlas/);
});
test('a failed PNG copy never calls MediaStore or exposes the private URI', async () => {
  const fixture = sharingFixture(); fixture.failCopy(); await fixture.render().share();
  await fixture.render().menu.onDownload();
  assert.equal(fixture.calls.filter(call => call[0] === 'save').length, 0);
  assert.equal(fixture.render().menu.notice, null);
  assert.equal(fixture.render().menu.error, "Couldn't save the image. Try again.");
});
test('repeated Download taps cannot create duplicate images while saving', async () => {
  const fixture = sharingFixture(); let resolve; fixture.blockSave(new Promise(yes => { resolve = yes; }));
  await fixture.render().share(); const menu = fixture.render().menu;
  const first = menu.onDownload(); await Promise.resolve(); await menu.onDownload();
  assert.equal(fixture.calls.filter(call => call[0] === 'save').length, 1);
  resolve(); await first; assert.equal(fixture.render().menu.saving, false);
});

const transactions = load('../src/api/transactions.ts', {
  react: {}, 'expo-router': {}, '@/api/client': {}, '@/auth/context': {}, '@/settings/context': {},
});
const receipt = (patch = {}) => ({ state: 'pending', stage: 'settle', summary: [{ label: 'Bank payout', value: 'Waiting for your USDC' }], ...patch });
test('funding submitted, payout processing, and an unreadable receipt never claim bank success', () => {
  for (const value of [null, receipt(), receipt({ summary: [{ label: 'Bank payout', value: 'Paying your bank' }] }), receipt({ stage: 'validate' })]) {
    assert.equal(transactions.bankTransferProgress(value).done, false);
  }
  assert.equal(transactions.bankTransferProgress(receipt({ summary: [{ label: 'Bank payout', value: 'Paying your bank' }] })).step, 1);
  assert.equal(transactions.bankTransferProgress(receipt({ state: 'filled' })).done, true);
  assert.equal(transactions.bankTransferProgress(receipt({ state: 'failed', error: 'Bank rejected the transfer' })).failed, true);
});
