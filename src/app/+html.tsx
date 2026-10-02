import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return <html lang="en"><head><meta charSet="utf-8" /><title>Atlas · One balance. Your world.</title><meta httpEquiv="X-UA-Compatible" content="IE=edge" /><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /><meta name="theme-color" content="#292C33" /><meta name="description" content="One balance. Your world. Send money, explore stocks and crypto, and put your cash to work with Atlas." /><link rel="manifest" href="/manifest.webmanifest" /><link rel="apple-touch-icon" href="/atlas-icon.png" /><meta name="apple-mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-title" content="Atlas" /><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" /><ScrollViewStyleReset /></head><body>{children}</body></html>;
}
