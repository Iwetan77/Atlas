// Privy's linked accounts are authoritative even while the native SDK list is still hydrating.
type LinkedWallet = { type: string; chain_type?: string; wallet_client_type?: string; address?: string };
export function hasEmbeddedWallet(accounts: readonly LinkedWallet[], chain: 'solana' | 'ethereum'): boolean {
  return accounts.some(account => account.type === 'wallet' && account.chain_type === chain
    && account.wallet_client_type === 'privy' && !!account.address);
}

// Reconnect the SDK's wallet transport only. No transaction is signed, sent, or retried here.
type Snapshot = {
  ready: boolean;
  userId: string | null;
  status: string;
  hasWallet: boolean;
  connect?: () => Promise<unknown>;
  recover?: () => Promise<unknown>;
};
type Scheduler = {
  set: (callback: () => void, delay: number) => unknown;
  clear: (timer: unknown) => void;
};
const delays = [750, 1_500, 3_000];

export function createWalletReconnect(
  scheduler: Scheduler = {
    set: (callback, delay) => setTimeout(callback, delay),
    clear: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  },
) {
  let snapshot: Snapshot | null = null;
  let owner: string | null = null;
  let attempts = 0;
  let inFlight = false;
  let timer: unknown = null;

  const clear = () => {
    if (timer !== null) scheduler.clear(timer);
    timer = null;
  };
  const reconcile = () => {
    const state = snapshot;
    if (!state?.ready || !state.userId || !state.hasWallet) { clear(); return; }
    if (state.status === 'connected') { attempts = 0; clear(); return; }
    if (inFlight) { clear(); return; }
    // Privy already has a connection attempt running in these other states.
    if (!['disconnected', 'error', 'needs-recovery'].includes(state.status)) { clear(); return; }
    const operation = state.status === 'needs-recovery' ? state.recover : state.connect;
    if (!operation || attempts >= delays.length) { clear(); return; }
    if (timer !== null) return;
    timer = scheduler.set(() => {
      timer = null;
      const current = snapshot;
      if (!current?.ready || current.userId !== state.userId || inFlight) return;
      const run = current.status === 'needs-recovery' ? current.recover
        : ['disconnected', 'error'].includes(current.status) ? current.connect : undefined;
      if (!run) return;
      attempts++;
      inFlight = true;
      // Readiness is changed by Privy, including a recovery request when needed. A failed
      // transport gets a bounded retry; signatures and transfers never pass through this path.
      void Promise.resolve().then(() => {
        if (!snapshot?.ready || snapshot.userId !== state.userId) return;
        return run();
      }).catch(() => {}).finally(() => {
        inFlight = false;
        reconcile();
      });
    }, delays[attempts]);
  };
  return {
    update(next: Snapshot) {
      const nextOwner = next.ready ? next.userId : null;
      if (nextOwner !== owner) { clear(); attempts = 0; owner = nextOwner; }
      snapshot = next;
      reconcile();
    },
    cancel() {
      clear();
      snapshot = null;
      owner = null;
      attempts = 0;
      // An SDK request cannot be cancelled. Retain inFlight until it finishes, so remounting
      // or switching accounts cannot launch another connection request over the first one.
    },
  };
}
