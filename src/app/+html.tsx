import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// On an iPhone Home Screen app with the full-screen status bar, iOS sizes the page short by the
// status bar's height, leaving a white strip under the tab bar. There, the app fills the whole
// screen, and what's behind it takes the tab bar's colour (set by the theme) instead of white.
// And anywhere on the web, a long unbroken word (a pasted address, a hash, a long name) wraps inside
// its card instead of running past it and pushing the page sideways. Phones' own text already does.
const standalone = `
html { background-color: var(--atlas-chrome, #444557); }
[dir="auto"], input, textarea { overflow-wrap: anywhere; }
@media all and (display-mode: standalone) {
  html, body, #root { height: 100vh; height: 100lvh; }
}`;

export default function Root({ children }: PropsWithChildren) {
  return <html lang="en"><head><meta charSet="utf-8" /><title>Atlas · One balance. Your world.</title><meta httpEquiv="X-UA-Compatible" content="IE=edge" /><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /><meta name="theme-color" content="#292C33" /><meta name="description" content="One balance. Your world. Send money, explore stocks and crypto, and put your cash to work with Atlas." /><link rel="manifest" href="/manifest.webmanifest" /><meta property="og:type" content="website" /><meta property="og:site_name" content="Atlas" /><meta property="og:title" content="Atlas · One balance. Your world." /><meta property="og:description" content="Send money, explore stocks and crypto, and put your cash to work with Atlas." /><meta property="og:url" content="https://justatlas.xyz" /><meta property="og:image" content="https://justatlas.xyz/og.png" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:image" content="https://justatlas.xyz/og.png" /><link rel="apple-touch-icon" href="/atlas-icon.png" /><meta name="apple-mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-title" content="Atlas" /><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" /><ScrollViewStyleReset /><style dangerouslySetInnerHTML={{ __html: standalone }} /></head><body>{children}</body></html>;
}
