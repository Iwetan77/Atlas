import { useEffect } from 'react';

import { applyPageTheme } from '@/web/page-appearance';
import { colors, type ThemeName } from '@/theme';

export function usePageAppearance(theme: ThemeName) {
  useEffect(() => {
    applyPageTheme(theme, colors.bgBase);
    const standalone = !!(navigator as Navigator & { standalone?: boolean }).standalone
      || window.matchMedia('(display-mode: standalone)').matches;
    const iphone = /iPhone|iPod/.test(navigator.userAgent);
    if (!standalone || !iphone) return;

    const fit = () => {
      // The physical screen includes areas outside WebKit's viewport. In particular, switching
      // the status-bar style for light mode can change the available height. Fit that viewport
      // in both themes, rather than stretching the app to screen.height and moving its tabs.
      const height = `${window.innerHeight}px`;
      for (const el of [document.documentElement, document.body, document.getElementById('root')]) {
        if (el) el.style.height = height;
      }
    };
    fit();
    const frame = requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    window.addEventListener('pageshow', fit);
    window.addEventListener('orientationchange', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', fit);
      window.removeEventListener('pageshow', fit);
      window.removeEventListener('orientationchange', fit);
      window.visualViewport?.removeEventListener('resize', fit);
    };
  }, [theme]);
}
