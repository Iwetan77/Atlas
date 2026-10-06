import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { webThemeBootstrap } from '@/theme';

// The document canvas and status-bar area follow the saved theme before the app paints.
// And anywhere on the web, a long unbroken word (a pasted address, a hash, a long name) wraps inside
// its card instead of running past it and pushing the page sideways. Phones' own text already does.
const standalone = `
html, body, #root { background-color: var(--atlas-page-bg, #292C33); }
#atlas-statusbar-backdrop {
  position: fixed; top: 0; left: 0; right: 0;
  height: env(safe-area-inset-top, 0px);
  background: var(--atlas-page-bg, #292C33);
  pointer-events: none; z-index: 2147483647;
}
[dir="auto"], input, textarea { overflow-wrap: anywhere; }`;

export default function Root({ children }: PropsWithChildren) {
  return <html lang="en"><head><meta charSet="utf-8" /><title>Atlas · One balance. Your world.</title><meta httpEquiv="X-UA-Compatible" content="IE=edge" /><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /><meta name="theme-color" content="#292C33" /><meta name="description" content="One balance. Your world. Send money, explore stocks and crypto, and put your cash to work with Atlas." /><link rel="manifest" href="/manifest.webmanifest" /><meta property="og:type" content="website" /><meta property="og:site_name" content="Atlas" /><meta property="og:title" content="Atlas · One balance. Your world." /><meta property="og:description" content="Send money, explore stocks and crypto, and put your cash to work with Atlas." /><meta property="og:url" content="https://justatlas.xyz" /><meta property="og:image" content="https://justatlas.xyz/og.png" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:image" content="https://justatlas.xyz/og.png" /><link rel="apple-touch-icon" href="/atlas-icon.png" /><meta name="apple-mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-title" content="Atlas" /><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" /><script dangerouslySetInnerHTML={{ __html: webThemeBootstrap }} /><ScrollViewStyleReset /><style dangerouslySetInnerHTML={{ __html: standalone }} /></head><body><div id="atlas-statusbar-backdrop" aria-hidden="true" />{children}</body></html>;
}
