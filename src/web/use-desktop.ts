import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

export function browserDevice(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return /Android/i.test(navigator.userAgent) ? 'android' : 'desktop';
}

const noBrowserEvents = () => () => {};
// A browser media query, or null on the phone: React Native has a `window` but no matchMedia.
function media(query: string): MediaQueryList | null {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : null;
}
export function useBrowserDevice() {
  return useSyncExternalStore(noBrowserEvents, browserDevice, () => 'desktop' as const);
}
function isStandalone() {
  const query = media('(display-mode: standalone)');
  return !!query && (query.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
}
function standaloneEvents(changed: () => void) {
  const query = media('(display-mode: standalone)');
  if (!query) return () => {};
  query.addEventListener('change', changed);
  return () => query.removeEventListener('change', changed);
}
export function useStandalone() { return useSyncExternalStore(standaloneEvents, isStandalone, () => false); }

// Server HTML and the first hydration paint agree; the browser updates the layout afterwards.
function desktopSnapshot() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth >= 1024 && browserDevice() === 'desktop';
}
function desktopEvents(changed: () => void) {
  const query = media('(min-width: 1024px)');
  if (!query) return () => {};
  query.addEventListener('change', changed);
  return () => query.removeEventListener('change', changed);
}
export function useDesktop() { return useSyncExternalStore(desktopEvents, desktopSnapshot, () => false); }
