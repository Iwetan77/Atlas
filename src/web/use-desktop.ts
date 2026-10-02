import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

export function browserDevice(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return /Android/i.test(navigator.userAgent) ? 'android' : 'desktop';
}

const noBrowserEvents = () => () => {};
export function useBrowserDevice() {
  return useSyncExternalStore(noBrowserEvents, browserDevice, () => 'desktop' as const);
}
function isStandalone() {
  return typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
}
function standaloneEvents(changed: () => void) {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia('(display-mode: standalone)');
  media.addEventListener('change', changed);
  return () => media.removeEventListener('change', changed);
}
export function useStandalone() { return useSyncExternalStore(standaloneEvents, isStandalone, () => false); }

// Server HTML and the first hydration paint agree; the browser updates the layout afterwards.
function desktopSnapshot() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth >= 1024 && browserDevice() === 'desktop';
}
function desktopEvents(changed: () => void) {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia('(min-width: 1024px)');
  media.addEventListener('change', changed);
  return () => media.removeEventListener('change', changed);
}
export function useDesktop() { return useSyncExternalStore(desktopEvents, desktopSnapshot, () => false); }
