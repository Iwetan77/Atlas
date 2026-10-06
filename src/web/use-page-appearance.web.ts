import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { applyPageTheme } from '@/web/page-appearance';
import { colors, type ThemeName } from '@/theme';

export function usePageAppearance(theme: ThemeName) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const standalone = !!(navigator as Navigator & { standalone?: boolean }).standalone
      || window.matchMedia('(display-mode: standalone)').matches;
    const iphone = /iPhone|iPod/.test(navigator.userAgent);
    const fit = () => {
      applyPageTheme(theme, colors.bgBase);
      if (!standalone || !iphone) return;
      // In translucent Home Screen mode WebKit can exclude the top inset from 100% height.
      // Wait for the provider's real inset, including its update after the first paint.
      const fullScreen = insets.top > 0 && window.innerHeight < window.screen.height
        && window.innerWidth < window.innerHeight;
      const height = fullScreen ? `${window.screen.height}px` : '';
      for (const el of [document.documentElement, document.body, document.getElementById('root')]) {
        if (el) el.style.height = height;
      }
    };
    fit();
    const frame = requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    window.addEventListener('pageshow', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', fit);
      window.removeEventListener('pageshow', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, [theme, insets.top]);
}
