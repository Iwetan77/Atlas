// Counts Privy wallet modals that open while a plan is signing. Any count above zero means the
// dashboard is still forcing wallet UIs and the one-confirmation rule is broken.
const PRIVY_MODAL = '#privy-modal-content, #privy-dialog';

export function watchWalletPrompts(): () => number {
  let count = 0;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(PRIVY_MODAL) || node.querySelector(PRIVY_MODAL)) count += 1;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    return count;
  };
}
