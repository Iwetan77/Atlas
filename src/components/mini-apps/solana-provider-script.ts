// Injected into a Solana mini app before its own scripts run: a Wallet Standard wallet called "Atlas"
// (what @solana/wallet-adapter and @wallet-standard/app dapps look for), plus a small window.solana
// for older dapps. Connecting reveals only the public address; every signature waits for the user's
// yes on an Atlas sheet. Bytes cross to the app as base64.
export const SOLANA_PROVIDER_SCRIPT = `(function () {
  if (window.__atlasSolana) return;
  window.__atlasSolana = true;
  var CHAIN = 'solana:mainnet';
  var ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiNGRjJFN0UiLz48L3N2Zz4=';
  var pending = {}, nextId = 0, listeners = { change: [] }, legacyListeners = {};
  var account = null;

  var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function fromBase58(text) {
    var bytes = [0];
    for (var i = 0; i < text.length; i++) {
      var carry = ALPHABET.indexOf(text[i]);
      if (carry < 0) throw new Error('invalid address');
      for (var j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 255; carry >>= 8; }
      while (carry) { bytes.push(carry & 255); carry >>= 8; }
    }
    for (var k = 0; k < text.length && text[k] === '1'; k++) bytes.push(0);
    return new Uint8Array(bytes.reverse());
  }
  function toBase58(bytes) {
    var digits = [0];
    for (var i = 0; i < bytes.length; i++) {
      var carry = bytes[i];
      for (var j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
      while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
    }
    var out = '';
    for (var k = 0; k < bytes.length && bytes[k] === 0; k++) out += '1';
    for (var d = digits.length - 1; d >= 0; d--) out += ALPHABET[digits[d]];
    return out;
  }
  function toBase64(bytes) {
    var text = '';
    for (var i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    return btoa(text);
  }
  function fromBase64(text) {
    var raw = atob(text), bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  function ask(method, params) {
    return new Promise(function (resolve, reject) {
      var id = ++nextId;
      pending[id] = { resolve: resolve, reject: reject };
      window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, method: method, params: params || {} }));
    });
  }
  window.__atlasReply = function (id, result, error) {
    var p = pending[id];
    if (!p) return;
    delete pending[id];
    if (error) { var e = new Error(error.message); e.code = error.code; p.reject(e); } else { p.resolve(result); }
  };

  var FEATURES = ['solana:signTransaction', 'solana:signAndSendTransaction', 'solana:signMessage', 'solana:signIn'];
  function makeAccount(address) {
    return Object.freeze({
      address: address,
      publicKey: fromBase58(address),
      chains: Object.freeze([CHAIN]),
      features: Object.freeze(FEATURES.slice()),
      label: 'Atlas',
      icon: ICON
    });
  }
  function emitChange() {
    var props = { accounts: wallet.accounts };
    listeners.change.forEach(function (fn) { try { fn(props); } catch (e) {} });
  }
  function mine(input) {
    if (!account || !input.account || input.account.address !== account.address) throw new Error('Not the connected Atlas account');
    if (input.chain && input.chain !== CHAIN) throw new Error('Atlas mini apps run on Solana mainnet');
  }
  async function connect() {
    if (!account) {
      var result = await ask('standard:connect');
      account = makeAccount(result.address);
      emitChange();
      emitLegacy('connect', legacyKey());
    }
    return { accounts: wallet.accounts };
  }
  async function disconnect() {
    if (!account) return;
    await ask('standard:disconnect');
    account = null;
    emitChange();
    emitLegacy('disconnect');
  }
  async function signTransaction() {
    var outputs = [];
    for (var i = 0; i < arguments.length; i++) {
      var input = arguments[i];
      mine(input);
      var result = await ask('solana:signTransaction', { transaction: toBase64(input.transaction) });
      outputs.push({ signedTransaction: fromBase64(result.signedTransaction) });
    }
    return outputs;
  }
  async function signAndSendTransaction() {
    var outputs = [];
    for (var i = 0; i < arguments.length; i++) {
      var input = arguments[i];
      mine(input);
      var result = await ask('solana:signAndSendTransaction', { transaction: toBase64(input.transaction), options: input.options || {} });
      outputs.push({ signature: fromBase64(result.signature) });
    }
    return outputs;
  }
  async function signMessage() {
    var outputs = [];
    for (var i = 0; i < arguments.length; i++) {
      var input = arguments[i];
      mine(input);
      var result = await ask('solana:signMessage', { message: toBase64(input.message) });
      outputs.push({ signedMessage: input.message, signature: fromBase64(result.signature), signatureType: 'ed25519' });
    }
    return outputs;
  }
  // Sign In With Solana: the message is built here from the dapp's fields, for this page's own domain.
  async function signIn() {
    var outputs = [];
    for (var i = 0; i < arguments.length; i++) {
      var input = arguments[i] || {};
      if (input.domain && input.domain !== location.host) throw new Error('Sign-in is for another site');
      await connect();
      if (input.address && input.address !== account.address) throw new Error('Not the connected Atlas account');
      var lines = [location.host + ' wants you to sign in with your Solana account:', account.address];
      if (input.statement) lines.push('', input.statement);
      var fields = [];
      if (input.uri) fields.push('URI: ' + input.uri);
      if (input.version) fields.push('Version: ' + input.version);
      if (input.chainId) fields.push('Chain ID: ' + input.chainId);
      if (input.nonce) fields.push('Nonce: ' + input.nonce);
      if (input.issuedAt) fields.push('Issued At: ' + input.issuedAt);
      if (input.expirationTime) fields.push('Expiration Time: ' + input.expirationTime);
      if (input.notBefore) fields.push('Not Before: ' + input.notBefore);
      if (input.requestId) fields.push('Request ID: ' + input.requestId);
      if (input.resources && input.resources.length) {
        fields.push('Resources:');
        input.resources.forEach(function (r) { fields.push('- ' + r); });
      }
      if (fields.length) lines.push('', fields.join('\\n'));
      var message = new TextEncoder().encode(lines.join('\\n'));
      var result = await ask('solana:signMessage', { message: toBase64(message), signIn: true });
      outputs.push({ account: account, signedMessage: message, signature: fromBase64(result.signature), signatureType: 'ed25519' });
    }
    return outputs;
  }

  var wallet = {
    version: '1.0.0',
    name: 'Atlas',
    icon: ICON,
    chains: [CHAIN],
    get accounts() { return account ? [account] : []; },
    features: {
      'standard:connect': { version: '1.0.0', connect: connect },
      'standard:disconnect': { version: '1.0.0', disconnect: disconnect },
      'standard:events': {
        version: '1.0.0',
        on: function (event, fn) {
          (listeners[event] = listeners[event] || []).push(fn);
          return function () { listeners[event] = listeners[event].filter(function (f) { return f !== fn; }); };
        }
      },
      'solana:signTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy', 0], signTransaction: signTransaction },
      'solana:signAndSendTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy', 0], signAndSendTransaction: signAndSendTransaction },
      'solana:signMessage': { version: '1.0.0', signMessage: signMessage },
      'solana:signIn': { version: '1.0.0', signIn: signIn }
    }
  };

  // Wallet Standard registration: announce now, and again to any app that says it's ready.
  function register(api) { try { api.register(wallet); } catch (e) {} }
  try { window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: register })); } catch (e) {}
  try { window.addEventListener('wallet-standard:app-ready', function (event) { register(event.detail); }); } catch (e) {}

  // The older window.solana interface, for dapps that predate the Wallet Standard.
  function legacyKey() {
    if (!account) return null;
    var bytes = account.publicKey;
    return { toBase58: function () { return account.address; }, toString: function () { return account.address; }, toBytes: function () { return bytes; }, toBuffer: function () { return bytes; }, equals: function (o) { return !!o && o.toString() === account.address; } };
  }
  function emitLegacy(event, data) {
    (legacyListeners[event] || []).forEach(function (fn) { try { fn(data); } catch (e) {} });
  }
  function serialize(tx) {
    return tx.version !== undefined ? tx.serialize() : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  }
  function rebuild(tx, bytes) {
    return tx.version !== undefined ? tx.constructor.deserialize(bytes) : tx.constructor.from(bytes);
  }
  var legacy = {
    isAtlas: true,
    get isConnected() { return !!account; },
    get publicKey() { return legacyKey(); },
    connect: async function () { await connect(); return { publicKey: legacyKey() }; },
    disconnect: disconnect,
    signTransaction: async function (tx) {
      var out = await signTransaction({ account: account, transaction: serialize(tx) });
      return rebuild(tx, out[0].signedTransaction);
    },
    signAllTransactions: async function (txs) {
      var signed = [];
      for (var i = 0; i < txs.length; i++) signed.push(await legacy.signTransaction(txs[i]));
      return signed;
    },
    signAndSendTransaction: async function (tx, options) {
      var out = await signAndSendTransaction({ account: account, transaction: serialize(tx), options: options });
      return { signature: toBase58(out[0].signature), publicKey: legacyKey() };
    },
    signMessage: async function (message) {
      var out = await signMessage({ account: account, message: message });
      return { signature: out[0].signature, publicKey: legacyKey() };
    },
    on: function (event, fn) { (legacyListeners[event] = legacyListeners[event] || []).push(fn); return legacy; },
    off: function (event, fn) { legacyListeners[event] = (legacyListeners[event] || []).filter(function (f) { return f !== fn; }); return legacy; },
    removeListener: function (event, fn) { return legacy.off(event, fn); }
  };
  if (!window.solana) window.solana = legacy;
  window.atlas = { solana: legacy };
})();
true;`;
