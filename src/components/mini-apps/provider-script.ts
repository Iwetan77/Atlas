// Injected into a mini app before its own scripts run: an EIP-1193 wallet (window.ethereum, also
// announced over EIP-6963) whose every request goes to Atlas. Atlas answers reads itself and asks
// the user before any signature or transaction.
export const PROVIDER_SCRIPT = `(function () {
  if (window.ethereum && window.ethereum.isAtlas) return;
  var listeners = {}, pending = {}, nextId = 0;
  function emit(event, data) {
    (listeners[event] || []).forEach(function (fn) { try { fn(data); } catch (e) {} });
  }
  var provider = {
    isAtlas: true,
    chainId: '0x2105',
    request: function (args) {
      return new Promise(function (resolve, reject) {
        var id = ++nextId;
        pending[id] = { resolve: resolve, reject: reject };
        window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, method: args.method, params: args.params || [] }));
      });
    },
    on: function (event, fn) { (listeners[event] = listeners[event] || []).push(fn); return provider; },
    removeListener: function (event, fn) {
      listeners[event] = (listeners[event] || []).filter(function (f) { return f !== fn; });
      return provider;
    },
    enable: function () { return provider.request({ method: 'eth_requestAccounts' }); },
    sendAsync: function (payload, callback) {
      provider.request(payload).then(
        function (result) { callback(null, { id: payload.id, jsonrpc: '2.0', result: result }); },
        function (error) { callback(error); }
      );
    }
  };
  window.__atlasReply = function (id, result, error) {
    var p = pending[id];
    if (!p) return;
    delete pending[id];
    if (error) { var e = new Error(error.message); e.code = error.code; p.reject(e); } else { p.resolve(result); }
  };
  window.__atlasEmit = emit;
  window.ethereum = provider;
  var info = {
    uuid: 'b2f7c3d4-5a6e-4f80-9a1b-2c3d4e5f6a7b',
    name: 'Atlas',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiNGRjJFN0UiLz48L3N2Zz4=',
    rdns: 'app.atlas.wallet'
  };
  function announce() {
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info: info, provider: provider }) }));
  }
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
})();
true;`;

// Methods a mini app may call that only read Base: answered straight from Atlas's Base RPC.
export const READ_METHODS = new Set([
  'eth_blockNumber',
  'eth_call',
  'eth_estimateGas',
  'eth_feeHistory',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getCode',
  'eth_getLogs',
  'eth_getStorageAt',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_maxPriorityFeePerGas',
]);

// Requests that need the user's approval first.
export const SIGN_METHODS = new Set(['personal_sign', 'eth_signTypedData_v4', 'eth_sendTransaction']);
