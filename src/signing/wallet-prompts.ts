// The Privy Expo SDK has no signing UI, so native can't show a wallet prompt. The web version
// watches the DOM for Privy's modal; this one exists so callers don't need platform checks.
export function watchWalletPrompts(): () => number {
  return () => 0;
}
