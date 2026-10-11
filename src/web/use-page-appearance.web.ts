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

    // While someone is typing, the keyboard and its suggestion bar resize the visible viewport on
    // every key. Resizing the page under a focused field makes WebKit drop the focus, which closes
    // the keyboard after each digit, so the page is only refit while nothing is being typed in.
    const typing = () => {
      const active = document.activeElement;
      return active instanceof HTMLElement && !!active.closest('input, textarea, [contenteditable="true"]');
    };
    const fit = () => {
      if (typing()) return;
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
    // Typing finished: fit the page the keyboard left behind.
    const done = () => requestAnimationFrame(fit);
    document.addEventListener('focusout', done);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', fit);
      window.removeEventListener('pageshow', fit);
      window.removeEventListener('orientationchange', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      document.removeEventListener('focusout', done);
    };
  }, [theme]);
}
